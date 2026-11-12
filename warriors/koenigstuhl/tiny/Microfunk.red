;redcode-tiny
;name Microfunk
;author inversed
;strategy Stone + Imp
;date 2022.05.09
;assert CORESIZE == 800

; . . . S t o n e . . . . . . . . . . .
step    equ     539
hop     equ     step/2 + 400
time    equ     512
zofs    equ     -1-(step*time)
bofs    equ     5

; . . . I m p . . . . . . . . . . . . .
istep   equ     267
iofs    equ     3
djs     equ     609
imp0    equ     s0+iofs-(istep*4)

; . . . q B o m b . . . . . . . . . . .
qa      equ     316
qb      equ     786
qc      equ     209
qd      equ     645
qa0     equ     x0+qa
qc0     equ     x0+qc
aq      equ     qa0+(i-1)*qb
bq      equ     qc0+(i-1)*qd

; . . . B o o t . . . . . . . . . . . .
sdist   equ     593
idist   equ     503
ipos    equ     x0+idist
spos    equ     x0+sdist
bpos    equ     spos+1+bofs
x0      equ     bomb
org     imp+1

; . . . . . . . . . . . . . . . . . . .

bomb    dat     } hop+1 ,   > 1
        djn.f    -2     ,   { zofs
        add     # step  ,     1
        mov       bofs  ,   @ 2
s0      spl     # 0     ,    -3
        add.f   # istep ,     1
        jmp       imp0  ,   { djs
imp     mov.i   # 400   ,     istep

    i   for     5
        mov     { aq    ,     bq
    rof

        mov       bomb  ,     bpos
        spl       1     ,   { qa0+5*qb
ifrom   spl       1     ,     s0+4
        mov     > s0    ,   { sgo
        mov     < ifrom ,   { igo
sgo     spl       spos+4,   { qa0+6*qb
igo     djn.f     ipos+4,   { qa0+7*qb

