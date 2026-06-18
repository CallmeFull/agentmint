#!/bin/bash
set -e
cd /home/ubuntu/agentmint/demo

# Build a list of (file, duration) pairs
durations=(3 2.5 2.5 2.5 2 2.5 3.5 2 2.5 2.5 2.5 2.5 2.5)
files=(01_hero 02_stats 03_agents 04_evolution 05_mint 06_pirate 07_pirate_chat 08_vote 09_samurai 10_scientist 11_bard 12_explore 13_leaderboard)

# Create input list
> /tmp/concat.txt
for i in "${!files[@]}"; do
  echo "file '/tmp/${files[$i]}.png'" >> /tmp/concat.txt
  echo "duration ${durations[$i]}" >> /tmp/concat.txt
done
# Loop back to start (concat demuxer needs this)
echo "file '/tmp/${files[0]}.png'" >> /tmp/concat.txt
echo "duration 1" >> /tmp/concat.txt

ffmpeg -y -f concat -safe 0 -i /tmp/concat.txt \
  -vsync vfr -pix_fmt yuv420p \
  -c:v libx264 -preset slow -crf 22 -movflags +faststart \
  walkthrough.mp4 2>&1 | tail -8
