import pyshark
import sys
import pandas as pd
import matplotlib.pyplot as plt

def extract_udp_packets(pcap_file, min_port=3000, max_port=3400):
    capture = pyshark.FileCapture(
        pcap_file,
        display_filter=f'udp.dstport >= {min_port} && udp.dstport <= {max_port}',
        keep_packets=False
    )

    timestamps = []
    lengths = []

    for packet in capture:
        try:
            ts = float(packet.sniff_timestamp)
            length = int(packet.length)
            timestamps.append(ts)
            lengths.append(length)
        except AttributeError:
            continue

    return pd.DataFrame({'timestamp': timestamps, 'bytes': lengths})

def process_data(df, interval=1.0):
    start_time = df["timestamp"].min()
    df["rel_time"] = df["timestamp"] - start_time
    df["bucket"] = (df["rel_time"] // interval).astype(int)
    
    grouped = df.groupby("bucket").agg(
        bytes_sent=("bytes", "sum")
    ).reset_index()

    grouped["rel_time"] = grouped["bucket"] * interval
    grouped["cumulative_bytes"] = grouped["bytes_sent"].cumsum()
    grouped["throughput_bps"] = grouped["bytes_sent"] / interval
    grouped["cumulative_throughput"] = grouped["throughput_bps"].cumsum()
    return grouped

def plot_graphs(df):
    # Cumulative Bytes Sent
    plt.figure(figsize=(12, 6))
    plt.plot(df["rel_time"], df["cumulative_bytes"], label="Cumulative Bytes Sent")
    plt.xlabel("Time (s)")
    plt.ylabel("Bytes")
    plt.title("Cumulative UDP Bytes Over Time (Ports 3000–3400)")
    plt.grid(True)
    plt.legend()
    plt.xlim(left=0)
    plt.ylim(bottom=0)
    plt.tight_layout()
    plt.show()

    # Throughput and Cumulative Throughput
    plt.figure(figsize=(12, 6))
    plt.plot(df["rel_time"], df["throughput_bps"], label="Throughput (Bytes/sec)")
    plt.plot(df["rel_time"], df["cumulative_throughput"], label="Cumulative Throughput")
    plt.xlabel("Time (s)")
    plt.ylabel("Bytes/sec")
    plt.title("UDP Throughput Over Time (Ports 3000–3400)")
    plt.grid(True)
    plt.legend()
    plt.xlim(left=0)
    plt.ylim(bottom=0)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <pcap_file>")
        sys.exit(1)

    pcap_file = sys.argv[1]
    df = extract_udp_packets(pcap_file)
    if df.empty:
        print("No matching UDP packets found.")
        sys.exit(0)

    processed = process_data(df)
    plot_graphs(processed)
