;redcode-94
;name XXX-Shot
;author Christian Schmidt
;strategy Entry #1 for the IRC tournament
;assert 1
;       CORESIZE 2000
;       MAXPROCESSES 2000
;       MAXCYCLES 50000


sOff    equ     (sOne+2+100)

sOne    add.f   #sPtr,       sPtr
        sne.i   *sPtr,       @sPtr
        djn.f   sOne,        @sPtr
        djn.f   sBomb,       sPtr

    for 4
        dat     0,           0
    rof

sPtr    dat     sOff,        4+sOff
        dat     10,          10
sBomb   spl     #20,         -200
sLoop   mov     sBomb,       }sPtr
        mov     sBomb,       >sPtr
sBack   djn.a   sLoop,       <sBomb

        dat     0,           0

gDiv    equ     10

gCount  div     #gDiv,       #-1

gSmall  mul.ab  #5,          gCount
        add.b   gCount,      sPtr
        add.b   gCount,      sPtr+1
        jmp     sOne+1,      0


        end  gCount
