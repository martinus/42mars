;redcode-94
;name fizBiShot
;author Christian Schmidt
;strategy .66c BiShot Scanner
;strategy IRC #13 Entry
;assert 1

sOff    equ     (sOne+2+40)

sOne    add.f   #sPtr,       sPtr
        sne.i   *sPtr,       @sPtr
        djn.f   sOne,        @sPtr
        djn.f   sBomb,       sPtr

    for 4
        dat     0,           0
    rof

sPtr    dat     sOff,        1264+sOff
        dat     10,          1270
sBomb   spl     #20,         -200
sLoop   mov     sBomb,       }sPtr
        mov     sBomb,       >sPtr
sBack   djn.a   sLoop,       <sBomb

        end     sOne+1
