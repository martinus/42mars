;redcode-94nop
;name King of Metal
;author Christian Schmidt
;strategy qscanner, stone, Moore-style paper
;assert 1
;optimax pws

placeP  equ      4411 
pStep1  equ      4208 
pStep2  equ      7795 
zero    equ qbomb
qtab3   equ qbomb
placeS  equ 970

qbomb dat >qoff, >qc2
paper   mov >pSrcS, >pDestS

        spl  2, <qb1
qtab2   spl  1, <qb2
        spl  1, <qb3

        mov >pSrcS,  >pDestS
        mov <pSrcP,  {pDestP
pDestS  spl @pDestP,  paper+placeS
        spl @pDestP, >pDestS
pDestP  djn  paper+placeP+6, #paper+placeS

pStone  spl #2 * 2862, {2 * 2862
        mov pAmmo, *2
        add.f pStone, 1
        mov 4655, 4655 + 2862
pSrcS   jmp -3, pStone
        dat 0,0
pAmmo   dat }1, >1

        for     4
        dat     0,              0
        rof

dat zero - 1, qa1
qtab1 dat zero - 1, qa2

pNext   spl   pStep1,  {pThis
        mov  }pThis, }pNext
        mov   pDat,  >pStep2
pThis   mov pNext+6, }pNext
        jmz.f pNext, *pThis
pDat    dat  <2667,  <5334
pSrcP   dat  0,      0

for 42-7
 dat 0, 0
 rof

qc2 equ ((1 + (qtab3-qptr)*qy) % CORESIZE)
qb1 equ ((1 + (qtab2-1-qptr)*qy) % CORESIZE)
qb2 equ ((1 + (qtab2-qptr)*qy) % CORESIZE)
qb3 equ ((1 + (qtab2+1-qptr)*qy) % CORESIZE)
qa1 equ ((1 + (qtab1-1-qptr)*qy) % CORESIZE)
qa2 equ ((1 + (qtab1-qptr)*qy) % CORESIZE)
qz equ 2108
qy equ 243
qgo sne qptr + qz*qc2, qptr + qz*qc2 + qb2
 seq <qtab3, qptr + qz*(qc2-1) + qb2
 jmp q0, }q0
 sne qptr + qz*qa2, qptr + qz*qa2 + qb2
 seq <qtab1, qptr + qz*(qa2-1) + qb2
 jmp q0, {q0
sne qptr + qz*qa1, qptr + qz*qa1 + qb2
 seq <(qtab1-1), qptr + qz*(qa1-1) + qb2
 djn.a q0, {q0
 sne qptr + qz*qb3, qptr + qz*qb3 + qb3
 seq <(qtab2+1), qptr + qz*(qb3-1) + (qb3-1)
 jmp q0, }q1
sne qptr + qz*qb1, qptr + qz*qb1 + qb1
 seq <(qtab2-1), qptr + qz*(qb1-1) + (qb1-1)
 jmp q0, {q1
 sne qptr + qz*qb2, qptr + qz*qb2 + qb2
 seq <qtab2, qptr + qz*(qb2-1) + (qb2-1)
 jmp q0
 seq >qptr, qptr + qz + (qb2-1)
 jmp q2, <qptr
seq qptr+(qz+1)*(qc2-1),qptr+(qz+1)*(qc2-1)+(qb2-1)
 jmp q0, }q0
seq qptr+(qz+1)*(qa2-1),qptr+(qz+1)*(qa2-1)+(qb2-1)
 jmp q0, {q0
seq qptr+(qz+1)*(qa1-1),qptr+(qz+1)*(qa1-1)+(qb2-1)
 djn.a q0, {q0
 jmz.f paper, qptr + (qz+1)*(qb2-1) + (qb2-1)
qoff equ -87
qstep equ -7
qtime equ 14
q0 mul.b *2, qptr
q2 sne {qtab1, @qptr
q1 add.b qtab2, qptr
 mov qtab3, @qptr
qptr mov qbomb, }qz
 sub #qstep, qptr
 djn -3, #qtime
 jmp paper
end qgo