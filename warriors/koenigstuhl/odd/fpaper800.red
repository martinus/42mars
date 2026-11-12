;redcode
;name FragPaper 800
;author Michal Janeczek
;strategy RF22 (tiny lp) entry
;strategy 4 process stone + 2 process paper + 2 process paper
;assert 1

head  add.x #7, >0
      mov <-1, <4
      mov 4, }370
      jmn -2, @-3
      spl @-4, >25
      jmz @0, 344
      dat >1, }1

      for 12
      dat 0, 0
      rof

stone add 2, 1
      mov }2*55, 366*55
      jmp -2, >-366

start mov stone+2, {boot
      mov stone+1, {boot
      mov stone, {boot
      spl head, >-103
      spl tail, >59
      spl *boot, >300
      spl *boot, >373
      spl *boot, >343
boot  jmp head-241, >-259

      for 12
      dat 0, 0
      rof

tail  add.x #7, >0
      mov <-1, <4
      mov 4, >-311
      jmn -2, @-3
      spl @-4, >12
      jmz @0, 119
      dat >1, }1

      end   start
