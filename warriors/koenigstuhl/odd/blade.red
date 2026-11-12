;redcode-94
;name Blade
;author Erki
;assert CORESIZE == 8000
STEP equ 3039

ORG boot
boot
spl 1
mov -1, 0
spl 1

spl 2
jmp imp
add.A #2667, -1

jmp start

p dat 0, STEP
start
mov }p, >p
spl STEP-1, >-100
nop >-100, #3
mov -4, >-1
djn -1, <-11

imp mov.i #0, 2667
END
