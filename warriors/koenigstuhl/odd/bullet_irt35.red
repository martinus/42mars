;redcode-irc
;name Bullet
;author Christian Schmidt
;strategy Coresize adjusting BiShot :)
;assert 1

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


gDiv    equ     10
gSval   equ     2000

gCount  div     #gDiv,       #-1
        jmp     gSmall,      >gCount

gSmall  mul.ab  #5,          gCount
        add.b   gCount,      sPtr
        add.b   gCount,      sPtr+1
        jmp     sOne+1,      0



        end  gCount
