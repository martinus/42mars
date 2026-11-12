;redcode-94 test
;name Hi Perf Test A 22
;author Steve Gunnell
;strategy .75c scanner from an idea by John Metcalf.
;assert 1

GAP   equ 1354
START equ 53063
bptr  equ (ptr-1-3)
SWITCH equ 30
UNROLL equ 7

LEN   equ (wipe-bptr+3)

ptr   dat    START  ,START+GAP+GAP
incr2 dat    GAP+GAP,GAP+GAP
incr1 dat    GAP    ,GAP    
throw mov.i  wipe   ,>bptr
      for UNROLL
      mov.i  *throw ,>bptr
      rof
      jmn.f  throw  ,@bptr
sgo   add.f  incr2  ,ptr
scan  sne.i  *ptr   ,@ptr
      add.f  incr1  ,ptr
      jmz.f  sgo    ,*ptr
      mov.ab ptr    ,bptr
      slt.b  bptr   ,#LEN
      jmp    throw  ,>bptr
      djn.b  sgo    ,#SWITCH
      mov.ab #SWITCH,-1
      jmp    sgo    ,}throw
wipe  spl    #0     ,}0

      end   scan

