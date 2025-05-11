import pyshark
import sys
import pandas as pd
import matplotlib.pyplot as plt
import argparse
import matplotlib.ticker as plticker

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

def plot_merged_graphs(baseline_df, vmb_df):
    # only graph between 110 and 180 seconds, shift graphs vertically to start at 0 cumulative bytes
    # baseline_df = baseline_df[(baseline_df["rel_time"] >= 110) & (baseline_df["rel_time"] <= 170)]
    # vmb_df = vmb_df[(vmb_df["rel_time"] >= 110) & (vmb_df["rel_time"] <= 170)]

    baseline_df["cumulative_bytes"] -= baseline_df["cumulative_bytes"].min()
    vmb_df["cumulative_bytes"] -= vmb_df["cumulative_bytes"].min()

    # shift graphs horizontally to start at 0 seconds
    baseline_df["rel_time"] -= baseline_df["rel_time"].min()
    vmb_df["rel_time"] -= vmb_df["rel_time"].min()
    # plt.figure(figsize=(12, 6))
    color1 = 'orangered'
    color2 = 'blue'

    fig, ax1 = plt.subplots()
    # fig.set_size_inches(6, 6)
    ax2 = ax1.twinx()  # instantiate a second Axes that shares the same x-axis

    # loc = plticker.MultipleLocator(100) # this locator puts ticks at regular intervals
    # ax1.yaxis.set_major_locator(loc)
    # ax1.yaxis.set_major_formatter(plticker.ScalarFormatter())
    # ax1.yaxis.set_minor_formatter(plticker.ScalarFormatter())
    # ax1.yaxis.set_major_locator(plticker.MultipleLocator(100))
    # y_major = plticker.LogLocator(base = 10.0, numticks = 5)
    ax1.set_yscale('log')
    ax1.set_ylabel("Bytes (log)", color=color1)
    ax1.tick_params(axis='y', which='both', colors=color1)
    ax1.spines['left'].set_color(color1)
    ax1.yaxis.label.set_color(color1)
    ax1.plot(baseline_df["rel_time"], baseline_df["cumulative_bytes"], label="Baseline Cumulative Bytes Sent", color=color1)
    [t.set_color(color1) for t in ax1.yaxis.get_ticklabels()]
    # https://stackoverflow.com/a/5487005
    ax1.legend(loc=0)


    # loc2 = plticker.MultipleLocator(100)
    # ax2.yaxis.set_major_locator(loc2)
    ax1.set_xlabel("Time (s)")
    ax2.set_ylabel("Bytes", color=color2)
    ax2.tick_params(axis='y', labelcolor=color2)
    ax2.spines['right'].set_color(color2)
    ax2.yaxis.label.set_color(color2)
    ax2.tick_params(axis='y', which='both', colors=color1)
    ax2.plot(vmb_df["rel_time"], vmb_df["cumulative_bytes"], label="VMB Cumulative Bytes Sent", color=color2)
    [t.set_color(color2) for t in ax2.yaxis.get_ticklabels()]
    plt.title("Cumulative Bytes Sent Over Time (Baseline vs VMB)")
    plt.grid(True)
    ax2.legend()
    plt.xlim(left=0)
    plt.ylim(bottom=0)
    # logarithmic scale for y-axis
    # plt.yscale('log')
    fig.tight_layout()
    plt.show()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: python {sys.argv[0]} <baseline_pcap> <vmb_pcap>")
        sys.exit(1)

    baseline_pcap = sys.argv[1]
    baseline_df = extract_udp_packets(baseline_pcap, 5540, 5560)
    if baseline_df.empty:
        print("No matching UDP packets found.")
        sys.exit(0)

    vmb_pcap = sys.argv[2]
    vmb_df = extract_udp_packets(vmb_pcap, 3000, 3400)
    if vmb_df.empty:
        print("No matching UDP packets found.")
        sys.exit(0)

    processed_baseline = process_data(baseline_df)
    processed_vmb = process_data(vmb_df)
    # plot_graphs(processed)
    plot_merged_graphs(processed_baseline, processed_vmb)
