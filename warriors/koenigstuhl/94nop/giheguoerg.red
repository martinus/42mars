;redcode-94nop
;name Giheguoerg
;author G.Labarga
;strategy Qscan->stone/paper
;assert CORESIZE==8000
;strategy stone/paper
;optimizar paloc?, stloc y distribución.
;comprobar boot y Qscan
; ver1: no paper boot, 2-spl stone
;papot1

;boot constants:
stloc equ (boot+2695)
;paloc

zero    equ     qbomb
qtab3   equ     qbomb

qbomb   dat     >qoff           , >qc2

boot:	mov bmb,stloc+11
	mov <ssrc,{sdst
	spl 2,	<qb1
qtab2   spl 2,	<qb2
        spl 1,	<qb3
	mov <ssrc,{sdst
sdst	djn *stloc,#5
	jmp plch,{0
for 9
	dat 0,0
rof
        dat     zero-1          , qa1
qtab1   dat     zero-1          , qa2

for 2
	dat 0,0
rof

pstep1 equ 6419
pstep2 equ 3552
patk equ 1372

plch:	spl 1
	spl 1,}0
	spl 1
paper:	spl @0,>pstep1
	mov }-1,>-1
	mov {-2,{1
	spl *pstep2,<pstep2-7
	mov 1,<2
	mov.i #1,<1
	djn.b -2,#patk
for 19
	dat 0,0
rof
;----- stone:
step EQU (7313*4)
dist EQU hit+2*step
adist EQU dist-2+(274*step)

ssrc:
head:	spl 0,6
start:	spl #-2*step,>-2*step
hit:	mov bmb+4,@ref
	sub.f start,@hit
ref:	mov >adist,>dist
	jmp hit,>hit+3692
for 7
 	dat 0,0
rof
bmb:	dat >2667,>step

;------- Q^4.5 ------
qc2     equ ((1+(qtab3-qptr)*qy)%CORESIZE)
qb1     equ ((1+(qtab2-1-qptr)*qy)%CORESIZE)
qb2     equ ((1+(qtab2-qptr)*qy)%CORESIZE)
qb3     equ ((1+(qtab2+1-qptr)*qy)%CORESIZE)
qa1     equ ((1+(qtab1-1-qptr)*qy)%CORESIZE)
qa2     equ ((1+(qtab1-qptr)*qy)%CORESIZE)
qz      equ 2108
qy      equ 243         ;qy*(qz-1)=1

;q0 mutation
qgo     sne     qptr+qz*qc2     , qptr+qz*qc2+qb2
        seq     <qtab3          , qptr+qz*(qc2-1)+qb2
        jmp     q0              , }q0
        sne     qptr+qz*qa2     , qptr+qz*qa2+qb2
        seq     <qtab1          , qptr+qz*(qa2-1)+qb2
        jmp     q0              , {q0
        sne     qptr+qz*qa1     , qptr+qz*qa1+qb2
        seq     <(qtab1-1)      , qptr+qz*(qa1-1)+qb2
        djn.a   q0              , {q0
                                        ;q1 mutation
        sne     qptr+qz*qb3     , qptr+qz*qb3+qb3
        seq     <(qtab2+1)      , qptr+qz*(qb3-1)+(qb3-1)
        jmp     q0              , }q1
        sne     qptr+qz*qb1     , qptr+qz*qb1+qb1
        seq     <(qtab2-1)      , qptr+qz*(qb1-1)+(qb1-1)
        jmp     q0              , {q1

        sne     qptr+qz*qb2     , qptr+qz*qb2+qb2
        seq     <qtab2          , qptr+qz*(qb2-1)+(qb2-1)
        jmp     q0
                                        ;qz mutation
        seq     >qptr           , qptr+qz+(qb2-1)
        jmp     q2              , <qptr
                                        ;q0 mutation
        seq     qptr+(qz+1)*(qc2-1),qptr+(qz+1)*(qc2-1)+(qb2-1)
        jmp     q0              , }q0
        seq     qptr+(qz+1)*(qa2-1),qptr+(qz+1)*(qa2-1)+(qb2-1)
        jmp     q0              , {q0
        seq     qptr+(qz+1)*(qa1-1),qptr+(qz+1)*(qa1-1)+(qb2-1)
        djn.a   q0              , {q0
        jmz.f   boot            , qptr+(qz+1)*(qb2-1)+(qb2-1)

qoff    equ     -86
qstep   equ     -7
qtime   equ     19

q0      mul.b   *2              , qptr
q2      sne     {qtab1          , @qptr
q1      add.b   qtab2           , qptr
        mov     qtab3           , @qptr
qptr    mov     qbomb           , }qz
        sub     #qstep          , qptr
        djn     -3              , #qtime
        djn.f   boot            , #0

end qgo

