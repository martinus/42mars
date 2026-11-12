;redcode-94x
;name Heimdal XA 59
;author Steve Gunnell
;strategy Yet another scanner. Not seen this style before
;assert 1

STEP   equ    45527
IMPNUM equ	  10151

bptr   dat    0        ,49244
for 1
       dat.f  $0       ,$0
rof
sptr   dat    bomb     ,0
for 2
       dat.f  $0       ,$0
rof
clear  mov.i  *sptr    ,>bptr
for 1
       mov.i  *sptr    ,>bptr
rof
       jmn.f  clear    ,@bptr
for 6
       dat.f  $0       ,$0
rof
       dat.f  $0       ,$0
scan   add.ab #STEP    ,sptr
       jmz.f  scan     ,@sptr
       slt.b  sptr     ,#tail-sptr
       mov.b  sptr     ,bptr
       spl    clear
       jmn.b  scan     ,sptr
       jmp    scan     ,}sptr
bomb   spl #0, }0
for 1
       jmp #-20, >IMPNUM
rof
for 6
       dat.f  $0       ,$0
rof
tail   dat.f  $0       ,$0

end    scan

