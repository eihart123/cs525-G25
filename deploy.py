import argparse
import curses
from io import StringIO
import json
import logging
import os
import re
import threading
from fabric import Connection, Config
from invoke.watchers import StreamWatcher
from queue import Queue

from getpass import getpass
from pathlib import Path, PurePosixPath
from time import sleep
from dotenv import load_dotenv


class SnapshotQueue(Queue):
    def snapshot(self):
        with self.mutex:
            return list(self.queue)


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
LEVEL_1_VMB_SERVERS = [
    "sp25-cs525-2502.cs.illinois.edu",
    "sp25-cs525-2503.cs.illinois.edu",
    "sp25-cs525-2504.cs.illinois.edu",
    "sp25-cs525-2505.cs.illinois.edu",
]

SERVERS = [
    "sp25-cs525-2501.cs.illinois.edu",
    "sp25-cs525-2502.cs.illinois.edu",
    "sp25-cs525-2503.cs.illinois.edu",
    "sp25-cs525-2504.cs.illinois.edu",
    "sp25-cs525-2505.cs.illinois.edu",
    "sp25-cs525-2506.cs.illinois.edu",
    "sp25-cs525-2507.cs.illinois.edu",
    "sp25-cs525-2508.cs.illinois.edu",
    "sp25-cs525-2509.cs.illinois.edu",
    "sp25-cs525-2510.cs.illinois.edu",
    "sp25-cs525-2511.cs.illinois.edu",
    "sp25-cs525-2512.cs.illinois.edu",
    "sp25-cs525-2513.cs.illinois.edu",
    "sp25-cs525-2514.cs.illinois.edu",
    "sp25-cs525-2515.cs.illinois.edu",
    "sp25-cs525-2516.cs.illinois.edu",
    "sp25-cs525-2517.cs.illinois.edu",
    "sp25-cs525-2518.cs.illinois.edu",
    "sp25-cs525-2519.cs.illinois.edu",
    "sp25-cs525-2520.cs.illinois.edu",
]

ip_mappings = {
    "sp25-cs525-2501.cs.illinois.edu": "fe80::250:56ff:fe8c:8777",
    "sp25-cs525-2502.cs.illinois.edu": "fe80::250:56ff:fe8c:57da",
    "sp25-cs525-2503.cs.illinois.edu": "fe80::250:56ff:fe8c:dc43",
    "sp25-cs525-2504.cs.illinois.edu": "fe80::250:56ff:fe8c:34c3",
    "sp25-cs525-2505.cs.illinois.edu": "fe80::250:56ff:fe8c:50b4",
    "sp25-cs525-2506.cs.illinois.edu": "fe80::250:56ff:fe8c:bfd9",
    "sp25-cs525-2507.cs.illinois.edu": "fe80::250:56ff:fe8c:69e1",
    "sp25-cs525-2508.cs.illinois.edu": "fe80::250:56ff:fe8c:cc0b",
    "sp25-cs525-2509.cs.illinois.edu": "fe80::250:56ff:fe8c:9744",
    "sp25-cs525-2510.cs.illinois.edu": "fe80::250:56ff:fe8c:d55",
    "sp25-cs525-2511.cs.illinois.edu": "fe80::250:56ff:fe8c:1ec1",
    "sp25-cs525-2512.cs.illinois.edu": "fe80::250:56ff:fe8c:1814",
    "sp25-cs525-2513.cs.illinois.edu": "fe80::250:56ff:fe8c:643e",
    "sp25-cs525-2514.cs.illinois.edu": "fe80::250:56ff:fe8c:b863",
    "sp25-cs525-2515.cs.illinois.edu": "fe80::250:56ff:fe8c:7b42",
    "sp25-cs525-2516.cs.illinois.edu": "fe80::250:56ff:fe8c:6c49",
    "sp25-cs525-2517.cs.illinois.edu": "fe80::250:56ff:fe8c:4ebd",
    "sp25-cs525-2518.cs.illinois.edu": "fe80::250:56ff:fe8c:c3b8",
    "sp25-cs525-2519.cs.illinois.edu": "fe80::250:56ff:fe8c:7915",
    "sp25-cs525-2520.cs.illinois.edu": "fe80::250:56ff:fe8c:8ca6",
}

# Level 1 to level 2 mappings
vmb_vmb_mappings = [
    {
        "sp25-cs525-2502.cs.illinois.edu": [
            "sp25-cs525-2505.cs.illinois.edu",
            "sp25-cs525-2506.cs.illinois.edu",
            "sp25-cs525-2507.cs.illinois.edu",
            "sp25-cs525-2508.cs.illinois.edu",
        ]
    },
    {
        "sp25-cs525-2503.cs.illinois.edu": [
            "sp25-cs525-2509.cs.illinois.edu",
            "sp25-cs525-2510.cs.illinois.edu",
            "sp25-cs525-2511.cs.illinois.edu",
            "sp25-cs525-2512.cs.illinois.edu",
        ]
    },
    {
        "sp25-cs525-2504.cs.illinois.edu": [
            "sp25-cs525-2513.cs.illinois.edu",
            "sp25-cs525-2514.cs.illinois.edu",
            "sp25-cs525-2515.cs.illinois.edu",
            "sp25-cs525-2516.cs.illinois.edu",
        ]
    },
    {
        "sp25-cs525-2505.cs.illinois.edu": [
            "sp25-cs525-2517.cs.illinois.edu",
            "sp25-cs525-2518.cs.illinois.edu",
            "sp25-cs525-2519.cs.illinois.edu",
            "sp25-cs525-2520.cs.illinois.edu",
        ]
    },
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

    result = conn.sudo("tmux kill-server", warn=True)
    if result.failed:
        update_status(server, "Failed to stop tmux")
        # return
    result = conn.run("tmux kill-server", warn=True)
    if result.failed:
        update_status(server, "Failed to stop tmux")

    result = conn.sudo(
        f"rm -rf {REMOTE_SERVER_DIR}/matter.js/packages/cs525/*.log", warn=True
    )
    if result.failed:
        update_status(server, "Failed to remove cs525 logs")

    result = conn.sudo(
        f"rm -rf {REMOTE_SERVER_DIR}/matter.js/packages/cs525-baseline/*.log", warn=True
    )
    if result.failed:
        update_status(server, "Failed to remove cs525-baseline logs")
        # return
    update_status(server, "Stopped")


def setup_server(conn: Connection, server: str, username: str):
    # Check that user logged in
    result = conn.run("whoami", warn=True)
    if result.failed or result.stdout.strip() != username:
        update_status(server, "Failed to login")

    update_status(server, "Initializing")

    # Install tmux
    conn.run("git config --global --add safe.directory /opt/matter/cs525-G25")
    result = conn.sudo("dnf install -y tmux", warn=True)
    if result.failed:
        update_status(server, "Failed to install tmux")
        return

    # result = conn.sudo(
    #     f"dnf install -y wireshark && usermod -a -G wireshark {username}", warn=True
    # )
    # if result.failed:
    #     update_status(server, "Failed to install wireshark")
    #     pass
    # Install node
    # result = conn.sudo("dnf module install -y nodejs:20/common", warn=True)
    # if result.failed:
    #     update_status(server, "Failed to install node")
    #     return

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
    result = conn.sudo(
        f"/bin/sh -c 'cd {REMOTE_SERVER_DIR}/matter.js && npm ci'", warn=True
    )
    if result.failed:
        update_status(server, "Failed to install dependencies")
        return

    update_status(server, "Building...")
    result = conn.sudo(
        f"/bin/sh -c 'cd {REMOTE_SERVER_DIR}/matter.js && npm run build'", warn=True
    )
    if result.failed:
        update_status(server, "Failed to build")
        return


filter = ""


def start_root_controller(
    conn: Connection, server: str, with_vmb: bool, message_queue: SnapshotQueue
):
    """Start the root controller on the remote server"""
    # update_status(server, f"{0} / {len(SERVERS) - 1} endnodes started")

    # Use this like a semaphore: block until we have all the endnodes AND level 1 vmbs
    while True:
        items = message_queue.snapshot()
        if len(items) >= 16:
            update_status(server, f"{len(items) - 16} / {4} level 1 vmbs started")
        elif len(items) <= 16:
            update_status(server, f"{len(items)} / {16} endnodes started")

        if len(items) >= 16 + 4:
            break
        sleep(1)

    update_status(server, "Starting root controller")
    dir = "cs525" if with_vmb else "cs525-baseline"
    serverFile = "RootControllerNode.js" if with_vmb else "ControllerNode.js"
    # These shouldn't run in the background, otherwise the session immediately exits

    update_status(server, "Starting tcpdump")
    dir = "cs525" if with_vmb else "cs525-baseline"
    pcap_dump_file = f"tcpdump_{server.split('.')[0]}.pcap"
    # filter = "'src portrange 5540-5560 or dst portrange 5540-5560'"
    # https://github.com/the-tcpdump-group/tcpdump/issues/485
    cmd1 = f'tmux new-session -d -s tcpdump "tcpdump -i any -U -w {REMOTE_SERVER_DIR}/{pcap_dump_file} {filter}"'
    result = conn.sudo(
        cmd1,
        warn=True,
    )
    if result.failed:
        update_status(server, "Failed to start tcpdump")
        return
    cmd2 = f"tmux new-session -d -s server 'node {REMOTE_SERVER_DIR}/matter.js/packages/{dir}/dist/esm/{serverFile} -- --storage-clear  2>&1 | tee {REMOTE_SERVER_DIR}/matter.js/packages/{dir}/root.log'"
    result = conn.sudo(
        cmd2,
        warn=True,
    )
    if result.failed:
        update_status(server, "Failed to start root controller")
        return
    with mutex:
        status[server]["output"] = cmd2
    # update_status(server, "Waiting plz")
    # sleep(20)

    # server_num = int(server.split(".")[0][-2:])
    # message_queue.put(server_num)
    update_status(server, "Online")


def start_level_1_vmb(
    conn: Connection, server: str, with_vmb: bool, message_queue: SnapshotQueue
):
    """Start the root controller on the remote server"""
    #

    assert with_vmb is True

    # Use this like a semaphore: block until we have all the endnodes
    while True:
        items = message_queue.snapshot()
        update_status(server, f"{len(items)} / {16} endnodes started")
        if len(items) >= 16:
            break
        sleep(1)
    # while msg_gotten < 16:
    #     try:
    #         server_gotten = message_queue.get(timeout=None)
    #         msg_gotten += 1
    #         update_status(server, f"{msg_gotten} / {len(SERVERS) - 1} endnodes started")
    #         status[server]["output"] = "Last from" + server_gotten
    #     except Exception as e:
    #         raise e

    update_status(server, "Starting tcpdump")
    dir = "cs525"
    pcap_dump_file = f"tcpdump_{server.split('.')[0]}.pcap"
    # filter = "'src portrange 5540-5560 or dst portrange 5540-5560'"
    # https://github.com/the-tcpdump-group/tcpdump/issues/485
    cmd1 = f'tmux new-session -d -s tcpdump "tcpdump -i any -U -w {REMOTE_SERVER_DIR}/{pcap_dump_file} {filter}"'
    result = conn.sudo(
        cmd1,
        warn=True,
    )
    if result.failed:
        update_status(server, "Failed to start tcpdump")
        return
    cmd2 = f"tmux new-session -d -s server 'bash {REMOTE_SERVER_DIR}/matter.js/packages/{dir}/startup_level1_vmb.sh'"
    result = conn.sudo(
        cmd2,
        warn=True,
    )
    if result.failed:
        update_status(server, "Failed to start level 1 vmb")
        return
    with mutex:
        status[server]["output"] = cmd2

    update_status(server, "Waiting")
    sleep(10)

    server_num = int(server.split(".")[0][-2:])
    message_queue.put(f"L1-{server_num}")
    update_status(server, "Online")


def startup_endnodes(
    conn: Connection, server: str, with_vmb: bool, message_queue: SnapshotQueue
):
    """Start the endnodes on the remote server"""
    # update_status(server, "Waiting for controlla")
    # message_queue.get()
    server_num = int(server.split(".")[0][-2:])

    # server_num 2 should be the first end node

    update_status(server, "Starting tcpdump")
    dir = "cs525" if with_vmb else "cs525-baseline"
    startup_scripts = (
        # endnodes need to start up *before* the level 2 vmbs
        ["startup_endnodes.sh", "startup_level2_vmb.sh"]
        if with_vmb
        else [
            "startup.sh",
        ]
    )
    # we don't need tcpdump for the level 2/endnodes
    if not with_vmb:
        pcap_dump_file = f"tcpdump_{server.split('.')[0]}.pcap"
        # filter = "'src portrange 5540-5560 or dst portrange 5540-5560'"
        # https://github.com/the-tcpdump-group/tcpdump/issues/485
        cmd1 = f'tmux new-session -d -s tcpdump "tcpdump -i any -U -w {REMOTE_SERVER_DIR}/{pcap_dump_file} {filter}"'
        result = conn.sudo(
            cmd1,
            warn=True,
        )
        if result.failed:
            update_status(server, "Failed to start tcpdump")
            return

    update_status(server, "Starting endnodes")
    for i, script in enumerate(startup_scripts):
        cmd2 = f"tmux new-session -d -s server{i} 'bash {REMOTE_SERVER_DIR}/matter.js/packages/{dir}/{script}'"
        result = conn.sudo(
            cmd2,
            warn=True,
        )

        with mutex:
            status[server]["output"] = cmd2
        if result.failed:
            update_status(server, f"Failed to start {script}")
            return
        update_status(server, "Waiting some time so that it can start")
        sleep(10)

    update_status(server, "Online")
    # message_queue.put(server_num)
    message_queue.put(server)


def install_config(conn: Connection, server: str):
    """Install the config on the remote server"""

    ip_mappings[server]
    is_root = server == CONTROLLER_SERVER
    is_level_1_vmb = server in LEVEL_1_VMB_SERVERS

    if is_root:
        root_config_file = "root_config.json"
        root_config = []
        for i, vmb_server in enumerate(LEVEL_1_VMB_SERVERS):
            root_config.append(
                {
                    "name": f"level_1_vmb_{vmb_server}",
                    "ip": ip_mappings[vmb_server],
                    "port": 3100 + i,
                }
            )

        root_config_file_io = StringIO()
        json.dump({"south": root_config}, root_config_file_io, indent=4)

        result = conn.put(
            root_config_file_io,
            f"{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{root_config_file}",
        )
        update_status(
            server,
            f"Installed config '{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{root_config_file}'",
        )

    if is_level_1_vmb:
        my_own_port = 3100 + LEVEL_1_VMB_SERVERS.index(server)
        level_2_vmb_port = 3200 + LEVEL_1_VMB_SERVERS.index(server) * 8

        level1_config_file = "vmb_level_1_config.json"
        level1_config = []
        for vmb_server in vmb_vmb_mappings:
            if server in vmb_server:
                for i, level_2_vmb_server in enumerate(vmb_server[server]):
                    level1_config.extend(
                        [
                            {
                                "name": f"level_2_vmb_{level_2_vmb_server}_1",
                                "ip": ip_mappings[level_2_vmb_server],
                                "port": level_2_vmb_port + i * 2,
                            },
                            {
                                "name": f"level_2_vmb_{level_2_vmb_server}_2",
                                "ip": ip_mappings[level_2_vmb_server],
                                "port": level_2_vmb_port + i * 2 + 1,
                            },
                        ]
                    )
                break

        level1_config_file_io = StringIO()
        json.dump(
            {
                "north": {"ip": ip_mappings[server], "port": my_own_port},
                "south": level1_config,
            },
            level1_config_file_io,
            indent=4,
        )

        result = conn.put(
            level1_config_file_io,
            f"{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{level1_config_file}",
        )
        update_status(
            server,
            f"Installed config '{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{level1_config_file}'",
        )

    server_num = int(server.split(".")[0][-2:])
    if server_num >= 5:
        # it's a level 2 vmb (1 is root, 2,3,4,5 are level 1 vmbs)
        # node 5 runs both a level 1 and level 2 vmb
        level2_config_file_1 = "vmb_level_2_config_1.json"
        level2_config_file_2 = "vmb_level_2_config_2.json"
        level2_config_1 = []
        level2_config_2 = []
        # We assume

        server_num_0_idx = server_num - 5
        # 2 vmbs per server, 10 nodes per vmb
        port_start = 3300 + server_num_0_idx * 2 * 10
        for i in range(10):
            level2_config_1.append(
                {
                    "name": f"endpoint_{server}_1_{i}",
                    "ip": ip_mappings[server],
                    "port": port_start + i,
                }
            )
            level2_config_2.append(
                {
                    "name": f"endpoint_{server}_2_{i}",
                    "ip": ip_mappings[server],
                    "port": port_start + i + 10,
                }
            )

        update_status(server, "Installing config")
        my_node = None
        for _, item in enumerate(vmb_vmb_mappings):
            l1_server = list(item.keys())[0]
            for i, level_2_vmb_server in enumerate(item[l1_server]):
                if level_2_vmb_server == server:
                    my_node = l1_server
                    break

        my_own_port = 3200 + LEVEL_1_VMB_SERVERS.index(my_node) * 8

        level2_config_file_1_io = StringIO()
        json.dump(
            {
                "north": {"ip": ip_mappings[my_node], "port": my_own_port},
                "south": level2_config_1,
            },
            level2_config_file_1_io,
            indent=4,
        )

        level2_config_file_2_io = StringIO()
        json.dump(
            {
                "north": {"ip": ip_mappings[my_node], "port": my_node},
                "south": level2_config_2,
            },
            level2_config_file_2_io,
            indent=4,
        )

        result = conn.put(
            level2_config_file_1_io,
            f"{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{level2_config_file_1}",
        )
        update_status(
            server,
            f"Installed config '{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{level2_config_file_1}'",
        )

        result = conn.put(
            level2_config_file_2_io,
            f"{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{level2_config_file_2}",
        )
        update_status(
            server,
            f"Installed config '{REMOTE_SERVER_DIR}/matter.js/packages/cs525/{level2_config_file_2}'",
        )


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
    server: str,
    username: str,
    password: str,
    with_vmb: bool,
    is_root: bool,
    is_level_1_vmb: bool,
    is_level_2_vmb: bool,
    message_queue: SnapshotQueue,
):
    """Connect to a server using SSH and restart the server"""
    try:
        update_status(server, "Connecting")

        # Establish SSH connection using Fabric
        conn = Connection(
            host=server,
            user=username,
            connect_kwargs={"password": password, "allow_agent": False},
            config=make_config(server),
        )

        setup_server(conn, server, username)
        stop_server(conn, server)
        # start_root_controller(conn, server, with_vmb=with_vmb)
        if not with_vmb:
            # install_config(conn, server)
            if is_root:
                start_root_controller(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )
            else:
                startup_endnodes(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )
        else:
            # This code needs to be first
            if is_level_2_vmb:
                startup_endnodes(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )

            if is_root:
                # start the root controller
                start_root_controller(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )

            if is_level_1_vmb:
                start_level_1_vmb(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )

        # start_server(conn, server)

    except Exception as e:
        update_status(server, f"Error: {str(e)}")
    finally:
        conn.close()


def ssh_connect_and_get_logs(
    server: str,
    username: str,
    password: str,
    with_vmb: bool,
    is_root: bool,
    is_level_1_vmb: bool,
    is_level_2_vmb: bool,
    message_queue: SnapshotQueue,
):
    """Connect to a server using SSH and get the logs"""

    server_prefix = server.split(".")[0]
    try:
        update_status(server, "Connecting")

        # Establish SSH connection using Fabric
        conn = Connection(
            host=server,
            user=username,
            connect_kwargs={"password": password, "allow_agent": False},
            config=make_config(server),
        )

        # Get the logs
        result = conn.run(f"ls {REMOTE_SERVER_DIR}/*.pcap", warn=True)
        stop_server(conn, server)
        if result.failed:
            update_status(server, "Failed to get logs")
            return
        for pcap_file in result.stdout.strip().splitlines():
            name = Path(pcap_file.strip()).name
            local_path = Path(LOCAL_SERVER_DIR) / server_prefix / name
            local_path.parent.mkdir(parents=True, exist_ok=True)
            update_status(server, f"Downloading {local_path.as_posix()}")
            conn.get((Path(REMOTE_SERVER_DIR) / name).as_posix(), local_path.as_posix())
            update_status(server, f"Downloaded {local_path.as_posix()}")

        # /opt/matter/cs525-G25/matter.js/packages/cs525
        dir = "cs525" if with_vmb else "cs525-baseline"
        result = conn.run(
            f"ls {REMOTE_SERVER_DIR}/matter.js/packages/{dir}/*.log", warn=True
        )

        if result.failed:
            update_status(server, "Failed to get logs")
            return

        for log_file in result.stdout.strip().splitlines():
            name = Path(log_file.strip()).name
            local_path = Path(LOCAL_SERVER_DIR) / server_prefix / name
            local_path.parent.mkdir(parents=True, exist_ok=True)
            remote_path = (
                Path(REMOTE_SERVER_DIR) / "matter.js" / "packages" / dir / name
            )
            update_status(server, f"Downloading {remote_path.as_posix()}")
            conn.get(remote_path.as_posix(), local_path.as_posix())
            update_status(server, f"Downloaded {local_path.as_posix()}")

    except Exception as e:
        update_status(server, f"Error: {str(e)}")
    finally:
        conn.close()


def ssh_connect_and_setup(
    server: str,
    username: str,
    password: str,
    with_vmb: bool,
    is_root: bool,
    is_level_1_vmb: bool,
    is_level_2_vmb: bool,
    message_queue: SnapshotQueue,
):
    """Connect to a server using SSH and setup the server"""
    try:
        update_status(server, "Connecting")

        # Establish SSH connection using Fabric
        conn = Connection(
            host=server,
            user=username,
            connect_kwargs={"password": password, "allow_agent": False},
            config=make_config(server),
        )

        setup_server(conn, server, username)
        stop_server(conn, server)
        # Update files
        # update_status(server, "Installing config")
        # install_config(conn, server)

        # TODO: remove
        # conn.close()
        # return

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
        result = conn.run(f"test -d {REMOTE_SERVER_DIR}/.git", warn=True)

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
            result = conn.run(
                f"rm -rf {REMOTE_SERVER_DIR} && git clone {GIT_REPO} {REMOTE_SERVER_DIR}",
                warn=True,
            )
            if result.failed:
                update_status(server, "Failed to clone repository")
                return
            # Check if the server directory was created
            result = conn.run(f"test -d {REMOTE_SERVER_DIR}/.git", warn=True)
            if result.failed:
                update_status(server, "Failed to create server directory")
                return
        build_server(conn, server)
        # start_server(conn, server)
        if not with_vmb:
            # install_config(conn, server)
            if is_root:
                start_root_controller(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )
            else:
                startup_endnodes(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )
        else:
            # This code needs to be first
            if is_level_2_vmb:
                startup_endnodes(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )
            if is_root:
                # start the root controller
                start_root_controller(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )
            if is_level_1_vmb:
                start_level_1_vmb(
                    conn, server, with_vmb=with_vmb, message_queue=message_queue
                )

    except Exception as e:
        update_status(server, f"Error: {str(e)}")
    finally:
        conn.close()


def ssh_connect_and_stop(
    server: str,
    username: str,
    password: str,
    with_vmb: bool,
    is_root: bool,
    is_level_1_vmb: bool,
    is_level_2_vmb: bool,
    message_queue: SnapshotQueue,
):
    """Connect to a server using SSH and stop the server process"""
    try:
        update_status(server, "Connecting")
        # Establish SSH connection using Fabric
        conn = Connection(
            host=server,
            user=username,
            connect_kwargs={"password": password, "allow_agent": False},
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
    global threads
    global password
    """Display the status of all servers using curses"""
    curses.curs_set(0)  # Hide cursor
    stdscr.nodelay(True)  # Make getch() non-blocking
    curses.start_color()

    # Define color pairs
    curses.init_pair(1, curses.COLOR_GREEN, curses.COLOR_BLACK)
    curses.init_pair(2, curses.COLOR_RED, curses.COLOR_BLACK)
    curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)
    collect_logs = False

    while True:
        stdscr.clear()
        stdscr.addstr(0, 0, "CS 625 Server Status Monitor", curses.A_BOLD)
        stdscr.addstr(1, 0, "Press 'q' to quit, 'c' to collect logs", curses.A_BOLD)

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
                # get the last two lines of the output
                output = "\n".join(output.splitlines()[-1:])

                stdscr.addstr(line_idx, 0, output, curses.A_BOLD)
                line_idx += output.count("\n") + 1
        stdscr.refresh()
        # Exit if 'q' is pressed
        if stdscr.getch() == ord("q"):
            break
        if stdscr.getch() == ord("c") and not collect_logs:
            # collect logs
            collect_logs = True
            for server in SERVERS:
                update_status(server, "Collecting logs")
                is_root = server == CONTROLLER_SERVER
                is_level_1_vmb = server in LEVEL_1_VMB_SERVERS
                server_num = int(server.split(".")[0][-2:])
                is_level_2_vmb = server_num >= 5
                thread = threading.Thread(
                    target=ssh_connect_and_get_logs,
                    args=(
                        server,
                        username,
                        password,
                        with_vmb,
                        is_root,
                        is_level_1_vmb,
                        is_level_2_vmb,
                        message_queue,
                    ),
                )
                thread.start()
                threads.append(thread)
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


threads = []
username = ""
with_vmb = False


message_queue = SnapshotQueue()


def main():
    global password
    global username
    global threads
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
        is_level_1_vmb = server in LEVEL_1_VMB_SERVERS
        server_num = int(server.split(".")[0][-2:])
        is_level_2_vmb = server_num >= 5
        thread = threading.Thread(
            target=target_action,
            args=(
                server,
                username,
                password,
                with_vmb,
                is_root,
                is_level_1_vmb,
                is_level_2_vmb,
                message_queue,
            ),
        )
        thread.start()
        threads.append(thread)

    # Start curses to display the status
    try:
        curses.wrapper(display_status)

    except KeyboardInterrupt:
        os._exit(0)

    # Wait for all threads to complete
    for thread in threads:
        thread.join()

    # Print final status for all servers
    print("Final status of all servers:")
    for server, state in status.items():
        print(f"{server}: {state}")


if __name__ == "__main__":
    main()
