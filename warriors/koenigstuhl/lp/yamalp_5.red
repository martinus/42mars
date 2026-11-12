;redcode-lp
;name Yamabushi
;author inversed
;strategy Scanner with spl/jmp attack and JD-clear
;strategy Improved version of YAMA-LP
;assert (CORESIZE==8000) && (MAXPROCESSES==8)

step    equ     70
hop     equ     6
sofs    equ     step
stream  equ     6516

safe    equ     16
anya    equ     4000
cptr    equ     kill-1

org     ptr

kill    dat       anya  ,     safe
inc     jmp     # step  ,     step

loop    add       inc   ,   @ x
ptr     sne       sofs  ,     sofs+hop
        djn.f     loop  ,   < stream
attack  mov       s0    ,   } ptr
x       mov       j1    ,   * ptr
        mov       j2    ,   @ ptr
        jmz.a     loop  ,   { ptr

s0      spl     # 0     ,     0
clear   mov       inc   ,   > cptr
j1      djn       clear ,   #-1
j2      jmp      -hop   ,   { clear

