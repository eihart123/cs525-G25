import sys
import matplotlib.pyplot as plt

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python parse-cpu.py baseline_cpu_usage.txt vmb_cpu_usage.txt")
        sys.exit(1)

    cpu_file_baseline = sys.argv[1]
    cpu_file_vmb = sys.argv[2]

    with open(cpu_file_baseline, "r") as f:
        lines_baseline = f.readlines()
      
    with open(cpu_file_vmb, "r") as f:
        lines_vmb = f.readlines()

    '''
    1746991569   14151 root      20   0   11.3g 163484  43776 S   0.0   4.4   0:03.61 node
    '''
    cpu_usage_baseline = []
    for line in lines_baseline:
        parts = line.split()
        if len(parts) < 13:
            continue
        if 'TIMESTAMP' in parts[0]:
            continue
        timestamp, pid, user, pr, ni, virt, res, shr, s, cpu, mem, time, command = parts
        
        cpu_usage_baseline.append((timestamp, cpu))
    
    cpu_usage_vmb = []
    for line in lines_vmb:
        parts = line.split()
        if len(parts) < 13:
            continue
        if 'TIMESTAMP' in parts[0]:
            continue
        timestamp, pid, user, pr, ni, virt, res, shr, s, cpu, mem, time, command = parts
        
        cpu_usage_vmb.append((timestamp, cpu))
      
  
    # Plot the CPU usage and memory usage
    timestamps_vmb = [int(x[0]) for x in cpu_usage_vmb]
    cpu_vmb = [float(x[1]) for x in cpu_usage_vmb]
    average_vmb = [sum(cpu_vmb[i:i+60])/60 for i in range(len(cpu_vmb))]

    timestamps_baseline = [int(x[0]) for x in cpu_usage_baseline]
    cpu_baseline = [float(x[1]) for x in cpu_usage_baseline]
    average_baseline = [sum(cpu_baseline[i:i+60])/60 for i in range(len(cpu_baseline))]


    # Normalize the timestamps to start from 0
    timestamps_vmb = [x - timestamps_vmb[0] for x in timestamps_vmb]
    timestamps_baseline = [x - timestamps_baseline[0] for x in timestamps_baseline]

    # Trim all data after the first 250 seconds
    timestamps_vmb = timestamps_vmb[:240]
    cpu_vmb = cpu_vmb[:240]
    average_vmb = average_vmb[:240]
    timestamps_baseline = timestamps_baseline[:240]
    cpu_baseline = cpu_baseline[:240]
    average_baseline = average_baseline[:240]
    

    plt.figure(figsize=(10, 5))
    plt.plot(timestamps_baseline, cpu_baseline, label="Baseline", color='sandybrown', linestyle=':', marker='x')
    plt.plot(timestamps_vmb, cpu_vmb, label="VMB", color='lightblue', linestyle=':', marker='*')
    plt.plot(timestamps_baseline, average_baseline, label="Baseline Average (60sec)", color='orangered')
    plt.plot(timestamps_vmb, average_vmb, label="VMB Average (60sec)", color='blue', linestyle='--')
    plt.legend(bbox_to_anchor=(1.4, 1.05))
    plt.xlabel("Time (s)")
    plt.ylabel("CPU Usage (%)")
    plt.yscale('log')
    # Show rolling average
    # plt.plot(timestamps, average, label="Rolling Average (60sec)", color='orange')

    plt.title("CPU Usage Over Time (Baseline vs VMB)")
    plt.legend()
    plt.grid()
    plt.savefig("cpu_usage.png")
    plt.show()