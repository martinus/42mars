;redcode-94nop
;name Coinflip gave me P
;author Miz
;strategy I let myself to be decieved too easily.
;assert 1
;irct23

step1 equ 7939
step2 equ 3415
step3 equ 5930
step4 equ 6232
D equ 800
dc    mov     {dc+D   ,       <dc+D+2
      mov     <dc+D+1 ,       <dc+D+4
      mov     {dc+D+5 ,       <dc+D+7
      djn.f    1    ,       <dc+D+9
spl 1, <-1200
spl 1, {-1250
spl 1, <-1300
spl p, {-1400
 spl @0, <step1
 mov.i }-1, >-1
 spl @0, {step2
 mov.i }-1, >-1
 mov.i 3, }step3
 mov.i {-3, <1
 jmp @0, step4
 dat.f <1, {1
dat $0, $0
p spl @0, <step1
  mov.i }-1, >-1
  spl @0, {step2
  mov.i }-1, >-1
  mov.i 3, }step3
  mov.i {-3, <1
  jmp @0, step4
  dat.f <2667, <5334
