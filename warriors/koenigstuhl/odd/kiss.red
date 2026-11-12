;redcode
;name KISS
;author Michal Janeczek
;strategy RF22 (tiny lp) entry
;strategy 4 process ssd clear + 4 process ssd clear
;assert 1

gate  dat -61, 65
      dat -15, wipe+2-gate
      dat -15, wipe+3-gate
clear spl #-25, wipe+4-gate
      mov @wipe, >gate
      mov @wipe, >gate
wipe  djn -2, {clear
      jmp -3, {-61

      for 35
      dat 0, 0
      rof

start spl 1, gate+8
      mov <start, <boot
      mov <start, <boot
      mov <start, <boot
      mov <start, <boot
      djn clear+380, #1
boot  jmp clear, gate+388

      end start
