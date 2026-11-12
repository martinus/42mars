;redcode-94nop
;name Mircalla
;author inversed
;strategy Countess Karnstein
;assert 1
;       (CORESIZE == 8000) && (MAXPROCESSES == 250)

; .33c vamp / .33c scan, hit found locations with jmp 0 bombs. Switch to the SSD
; clear as soon as the enemy is trapped or the pit is overwritten. Uses indirect
; pit references to protect the pit from anti-vamp bombing.

step    equ     5851 ; Mod~17
time    equ      471 ; ~= CORESIZE / 17
phaze   equ     step*time
atrace  equ     2*step

safe    equ     16
djs     equ     -1
zclear  equ     pit-cptr-2
cptr    equ     (kill-5)

gap1    equ     2
gap2    equ     7

org     head

kill    dat       0         ,     safe
cs0     spl     # djs       ,     zclear
clear   mov     @ ref       ,   > cptr
        mov     @ ref       ,   > cptr
ref     djn       clear     ,   { cs0

for     gap1
        dat       0         ,     0
rof

head    mov     #-atrace    ,     pit+atrace
loop    add       inc       ,     ptr
        mov       ptr       ,   @ ptr
        jmz.f     loop      ,   * ptr
        mov       bomb      ,   * ptr
        jmz.f     loop      ,     pit
        spl       cs0       ,   < cptr
inc     djn.f   #-step      ,   < step
bomb    jmp     # 1         ,   < 1

for     gap2
        dat       0         ,     0
rof

ptr     jmp     @ 0+phaze   ,     pit+atrace-phaze
pit     djn     # 0         ,   # 0

