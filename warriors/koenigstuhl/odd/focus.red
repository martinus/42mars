;redcode-94nop
;author inversed
;name Focus
;strategy Zooom-clone 
;assert 1

; Modified speed trick: self-modification is executed only once, reducing the
; number of vulnerable instructions. I've used a strange-looking SSD clear, as
; it gives an advantage against papers compared to DClear.

FOR CORESIZE == 800
        step    equ     (-45)
        decoy   equ     675
        ikill   equ     267
ROF
FOR CORESIZE == 8000
        step    equ     6185
        decoy   equ     6750
        ikill   equ     2667
ROF
FOR CORESIZE == 55440
        step    equ     9865
        decoy   equ     46775
        ikill   equ     34117
ROF

safe    equ     15
cptr    equ     tweak-2
zofs    equ     step
dex     equ     x0+decoy
x0      equ     tweak
org     dmake

tweak   nop     { ptr   ,   } ptr+1
bptr    mov       ptr   ,   # 0
wipe    mov       bomb  ,   > bptr
scan    add     # step  ,     ptr
ptr     jmz.f     scan  ,     zofs
        jmn       tweak ,   * bptr
bomb    spl     # 0     ,     0
clr     mov       stun  ,   > cptr
        djn       clr   ,   # 0
        dat     { 0     ,   { 0
kill    dat     < ikill ,     safe
stun    spl     # safe  ,   # safe

for     8
        dat       0     ,     0
rof

dmake   nop     } dex   ,   > dex+1
        mov     { dex+2 ,   < dex+12
        mov     < dex+3 ,   { dex+6
        djn.f     ptr   ,   < dex+8
