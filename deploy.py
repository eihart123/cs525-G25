import argparse
import curses
import logging
import os
import re
import threading
from fabric import Connection, Config
from invoke.watchers import StreamWatcher

from getpass import getpass
from pathlib import Path, PurePosixPath
from time import sleep
from dotenv import load_dotenv

load_dotenv()
# logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Options
MP_DIR = "/opt/matter"
LOCAL_SERVER_DIR = "./"
REMOTE_SERVER_DIR = f"{MP_DIR}/cs525-G25/"
REMOTE_GROUP = "csvm525-stu"
GIT_REPO = "https://github.com/eihart123/cs525-G25.git"
# List of servers
CONTROLLER_SERVER = "sp25-cs525-2501.cs.illinois.edu"
SERVERS = [
    "sp25-cs525-2501.cs.illinois.edu",
    "sp25-cs525-2502.cs.illinois.edu",
    "sp25-cs525-2503.cs.illinois.edu",
    "sp25-cs525-2504.cs.illinois.edu",
    # 'sp25-cs525-2505.cs.illinois.edu',
    # 'sp25-cs525-2506.cs.illinois.edu',
    # 'sp25-cs525-2507.cs.illinois.edu',
    # 'sp25-cs525-2508.cs.illinois.edu',
    # 'sp25-cs525-2509.cs.illinois.edu',
    # 'sp25-cs525-2510.cs.illinois.edu',
    # 'sp25-cs525-2511.cs.illinois.edu',
    # 'sp25-cs525-2512.cs.illinois.edu',
    # 'sp25-cs525-2513.cs.illinois.edu',
    # 'sp25-cs525-2514.cs.illinois.edu',
    # 'sp25-cs525-2515.cs.illinois.edu',
    # 'sp25-cs525-2516.cs.illinois.edu',
    # 'sp25-cs525-2517.cs.illinois.edu',
    # 'sp25-cs525-2518.cs.illinois.edu',
    # 'sp25-cs525-2519.cs.illinois.edu',
    # 'sp25-cs525-2520.cs.illinois.edu',
]

status = {server: {"msg": "Waiting"} for server in SERVERS}
mutex = threading.Lock()


def update_status(server: str, new_status: str):
    """Helper function to update the status of a server"""
    with mutex:
        status[server]["msg"] = new_status
        logger.debug(f"{server}: {new_status}")


def stop_server(conn: Connection, server: str):
    """Stop the server process on the remote server"""
    update_status(server, "Stopping")
    # killall node
    result = conn.sudo("killall node", warn=True)
    if result.failed:
        # Try again for the bit
        result = conn.sudo("killall node", warn=True)
        if result.failed:
            update_status(server, "Failed to stop server")
            # return

    result = conn.sudo("rm -rf ~/.matter", warn=True)
    if result.failed:
        update_status(server, "Failed to cached metadata")
        # return

    result = conn.sudo("killall tcpdump", warn=True)
    if result.failed:
        update_status(server, "Failed to stop tcpdump")
        # return

    update_status(server, "Stopped")


def setup_server(conn: Connection, server: str, username: str):
    # Check that user logged in
    result = conn.run("whoami", warn=True)
    if result.failed or result.stdout.strip() != username:
        update_status(server, "Failed to login")

    update_status(server, "Initializing")

    # Install tmux
    result = conn.sudo("dnf install -y tmux", warn=True)
    if result.failed:
        update_status(server, "Failed to install tmux")
        return

    result = conn.sudo(
        f"dnf install -y wireshark && usermod -a -G wireshark {username}", warn=True
    )
    if result.failed:
        update_status(server, "Failed to install wireshark")
        return
    # Install node
    result = conn.sudo("dnf module install -y nodejs:20/common", warn=True)
    if result.failed:
        update_status(server, "Failed to install node")
        return

    # Check if MP_DIR exists and create it if it doesn't
    result = conn.run(f"test -d {MP_DIR}", warn=True)
    if result.failed:
        result = conn.sudo(f"mkdir -p {MP_DIR}", warn=True)
        if result.failed:
            update_status(server, f"Failed to create {MP_DIR}")
            return
        result = conn.sudo(f"chown root:{REMOTE_GROUP} {MP_DIR}", warn=True)
        if result.failed:
            update_status(server, f"Failed to change owner for {MP_DIR}")
            return
        result = conn.sudo(f"chmod 2775 {MP_DIR}", warn=True)
        if result.failed:
            update_status(server, f"Failed to change permissions for {MP_DIR}")
            return
        result = conn.sudo(f"setfacl -d -m g:{REMOTE_GROUP}:rwx {MP_DIR}", warn=True)
        if result.failed:
            update_status(server, f"Failed to set default group ACL for {MP_DIR}")
            return
        result = conn.sudo(f"setfacl -d -m o::0 {MP_DIR}", warn=True)
        if result.failed:
            update_status(server, f"Failed to set default other ACL for {MP_DIR}")
            return


def build_server(conn: Connection, server: str):
    """Build the server on the remote server"""
    update_status(server, "Installing dependencies...")
    result = conn.run(f"cd {REMOTE_SERVER_DIR}/matter.js && npm ci", warn=True)
    if result.failed:
        update_status(server, "Failed to install dependencies")
        return

    update_status(server, "Building...")
    result = conn.run(f"cd {REMOTE_SERVER_DIR}/matter.js && npm run build", warn=True)
    if result.failed:
        update_status(server, "Failed to build")
        return


def start_root_controller(conn: Connection, server: str, with_vmb: bool):
    """Start the root controller on the remote server"""
    update_status(server, "Starting root controller")
    dir = "cs525" if with_vmb else "cs525-baseline"
    serverFile = "RootControllerNode.js" if with_vmb else "ControllerNode.js"
    result = conn.run(
        f"cd {REMOTE_SERVER_DIR}/matter.js/packages/{dir} && nohup node ./dist/esm/${serverFile} -- --storage-clear",
        warn=True,
    )
    if result.failed:
        update_status(server, "Failed to start root controller")
        return
    update_status(server, "Online")


def startup_endnodes(conn: Connection, server: str, with_vmb: bool):
    """Start the endnodes on the remote server"""
    update_status(server, "Starting tcpdump")
    dir = "cs525" if with_vmb else "cs525-baseline"
    pcap_dump_file = f"tcpdump_{server}.pcap"
    # https://github.com/the-tcpdump-group/tcpdump/issues/485
    result = conn.sudo(
        f"cd {REMOTE_SERVER_DIR} && nohup tcpdump -i any -U -w {pcap_dump_file} 'src portrange 5540-5560 or dst portrange 5540-5560' > /dev/null 2>&1 &",
        warn=True,
    )
    if result.failed:
        update_status(server, "Failed to start tcpdump")
        return
    update_status(server, "Starting endnodes")

    result = conn.sudo(
        f"cd {REMOTE_SERVER_DIR}/matter.js/packages/{dir} && chmod +x ./startup.sh && ./startup.sh",
        warn=True,
    )

    if result.failed:
        update_status(server, "Failed to start endnodes")
        return
    update_status(server, "Online")


# def start_server(conn, server):
#     """Start the server on the remote server"""
#     update_status(server, "Starting")
#     result = conn.run(f"cd {REMOTE_SERVER_DIR} && tmux new -d '/bin/sh -c \"./main server --fqdn={server}; exec bash\"'", warn=True, pty=False)
#     # Wait for the server to start
#     sleep(2)
#     update_status(server, "Online")


def recursive_upload(conn: Connection, local_path, remote_path):
    """Recursively upload files from a local directory to a remote directory"""
    if os.path.isdir(local_path):
        # skip target directory and output directory
        if "target" in local_path or "output" in local_path or "venv" in local_path:
            return
        conn.run(f"mkdir -p {remote_path}")
        for item in os.listdir(local_path):
            recursive_upload(conn, f"{local_path}/{item}", f"{remote_path}/{item}")
    else:
        # skip hidden files and doucmentation files
        if ".git" in local_path or ".gitignore" in local_path:
            return
        corrected_local_path = Path(local_path)
        corrected_remote_path = PurePosixPath(remote_path)
        conn.put(str(corrected_local_path), str(corrected_remote_path))


def ssh_connect_and_restart(
    server: str, username: str, password: str, with_vmb: bool, is_root: bool
):
    """Connect to a server using SSH and restart the server"""
    try:
        update_status(server, "Connecting")

        # Establish SSH connection using Fabric
        conn = Connection(
            host=server,
            user=username,
            connect_kwargs={"password": password},
            config=make_config(server),
        )

        setup_server(conn, server, username)
        stop_server(conn, server)
        # start_root_controller(conn, server, with_vmb=with_vmb)
        if is_root:
            # start the root controller
            start_root_controller(conn, server, with_vmb=with_vmb)
        else:
            startup_endnodes(conn, server, with_vmb=with_vmb)
        # start_server(conn, server)

    except Exception as e:
        update_status(server, f"Error: {str(e)}")
    finally:
        conn.close()


def ssh_connect_and_setup(
    server: str, username: str, password: str, with_vmb: bool, is_root: bool
):
    """Connect to a server using SSH and setup the server"""
    try:
        update_status(server, "Connecting")

        # Establish SSH connection using Fabric
        conn = Connection(
            host=server,
            user=username,
            connect_kwargs={"password": password},
            config=make_config(server),
        )

        setup_server(conn, server, username)
        stop_server(conn, server)
        # Update files
        update_status(server, "Updating")
        # Check if the server directory exists and delete it if it does
        # result = conn.run(f"test -d {REMOTE_SERVER_DIR}", warn=True)
        # if not result.failed:
        #     result = conn.run(f"rm -rf {REMOTE_SERVER_DIR}", warn=True)
        #     if result.failed:
        #         update_status(server, "Failed to delete existing server directory (rm failed)")
        #         return
        #     # Check if the server directory was deleted
        #     result = conn.run(f"test -d {REMOTE_SERVER_DIR}", warn=True)
        #     if not result.failed:
        #         update_status(server, "Failed to delete existing server directory (still exists)")
        #         return
        # Upload source files from local directory to remote directory
        # recursive_upload(conn, LOCAL_SERVER_DIR, REMOTE_SERVER_DIR)

        # git clone the repo into the remote directory, if it does, run git pull, else git clone
        # Check if the server directory exists
        result = conn.run(f"test -d {REMOTE_SERVER_DIR}", warn=True)

        if not result.failed:
            # git pull
            result = conn.run(
                f"cd {REMOTE_SERVER_DIR} && git reset --hard HEAD && git pull",
                # f"cd {REMOTE_SERVER_DIR} && git pull",
                warn=True,
            )
            if result.failed:
                update_status(server, "Failed to pull repository")
                return
        else:
            # git clone
            result = conn.run(f"git clone {GIT_REPO} {REMOTE_SERVER_DIR}", warn=True)
            if result.failed:
                update_status(server, "Failed to clone repository")
                return
            # Check if the server directory was created
            result = conn.run(f"test -d {REMOTE_SERVER_DIR}", warn=True)
            if result.failed:
                update_status(server, "Failed to create server directory")
                return
        build_server(conn, server)
        # start_server(conn, server)
        if is_root:
            # start the root controller
            start_root_controller(conn, server, with_vmb=with_vmb)
        else:
            startup_endnodes(conn, server, with_vmb=with_vmb)

    except Exception as e:
        update_status(server, f"Error: {str(e)}")
    finally:
        conn.close()


def ssh_connect_and_stop(
    server: str, username: str, password: str, with_vmb: bool, is_root: bool
):
    """Connect to a server using SSH and stop the server process"""
    try:
        update_status(server, "Connecting")
        # Establish SSH connection using Fabric
        conn = Connection(
            host=server,
            user=username,
            connect_kwargs={"password": password},
            config=make_config(server),
        )
        # Stop server process
        stop_server(conn, server)
    except Exception as e:
        update_status(server, f"Error: {str(e)}")
    finally:
        conn.close()


def make_watcher(server: str):
    ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

    class OutputWatcher(StreamWatcher):
        def submit(self, stream):
            # with mutex:
            # print(stream)
            result = ansi_escape.sub("", stream)
            status[server]["output"] = result
            return []

    return OutputWatcher()


# Function to display the dynamic status matrix using curses
def display_status(stdscr):
    """Display the status of all servers using curses"""
    curses.curs_set(0)  # Hide cursor
    stdscr.nodelay(True)  # Make getch() non-blocking
    curses.start_color()

    # Define color pairs
    curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)
    curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)
    curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)

    while True:
        stdscr.clear()
        stdscr.addstr(0, 0, "CS 625 Server Status Monitor", curses.A_BOLD)
        stdscr.addstr(1, 0, "Press 'q' to quit")

        with mutex:
            line_idx = 3
            for idx, server in enumerate(SERVERS):
                server_status = status[server]["msg"]
                # Assign colors based on the status
                if any(
                    status in server_status
                    for status in ["Online", "Stopped", "Success"]
                ):
                    color = curses.color_pair(1)
                elif any(status in server_status for status in ["Failed", "Error"]):
                    color = curses.color_pair(2)
                else:
                    color = curses.color_pair(3)
                # Display the status with color
                stdscr.addstr(line_idx, 0, f"{server}: {server_status}", color)
                line_idx += 1
                output = status[server].get("output", "-" * 50)
                # get the last three lines of the output
                output = "\n".join(output.splitlines()[-3:])

                stdscr.addstr(line_idx, 0, output, curses.A_BOLD)
                line_idx += output.count("\n") + 1
        stdscr.refresh()
        # Exit if 'q' is pressed
        if stdscr.getch() == ord("q"):
            break
        # Refresh the display every second
        sleep(1)


def make_config(server: str):
    """Create a Fabric config object with custom watchers"""
    return Config(
        {
            "run": {
                "watchers": [
                    make_watcher(server),
                ],
                "hide": True,
            },
            "sudo": {
                "watchers": [
                    make_watcher(server),
                ],
                "password": password,
            },
        },
    )


def main():
    global password
    parser = argparse.ArgumentParser(
        prog="CS 525 Deployment Script",
        description="Deploy the Matter testbed to multiple servers",
        epilog="Default behavior: uploads the server source code, builds it, and starts the server process",
    )
    parser.add_argument("-u", "--user", type=str, help="Username for SSH login")
    parser.add_argument(
        "-k",
        "--kill",
        action="store_true",
        help="Just shutdown existing server processes",
    )
    parser.add_argument(
        "-r", "--restart", action="store_true", help="Restart the server processes"
    )
    parser.add_argument(
        "-v", "--vmb", action="store_true", help="Use VMB version of the server"
    )
    args = parser.parse_args()

    default_username = args.user
    if not default_username:
        username = os.getenv("USERNAME") or input("Enter your username: ")
    else:
        print(f"Using username: {default_username}")
        username = default_username
    password = os.getenv("PASSWORD") or getpass("Enter your password: ")

    threads = []
    with_vmb = args.vmb

    # Choose target action
    target_action = None
    if args.kill:
        target_action = ssh_connect_and_stop
    elif args.restart:
        target_action = ssh_connect_and_restart
    else:
        target_action = ssh_connect_and_setup

    # Start a thread for each server
    for server in SERVERS:
        is_root = server == CONTROLLER_SERVER
        thread = threading.Thread(
            target=target_action, args=(server, username, password, with_vmb, is_root)
        )
        thread.start()
        threads.append(thread)

    # Start curses to display the status
    curses.wrapper(display_status)

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # Print final status for all servers
    print("Final status of all servers:")
    for server, state in status.items():
        print(f"{server}: {state}")


if __name__ == "__main__":
    main()
