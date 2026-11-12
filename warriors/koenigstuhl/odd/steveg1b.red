;redcode
;name Nibelung B tdnd
;author Steve Gunnell
;strategy A dwarf and a ring.
;strategy Armadillo clone
;assert 1

MARK	equ	>4381
SOFF	equ	7250
LOFF	equ	944
IOFF	equ	4046

boot	spl	iboot	,stone+8
	mov.i	imp	,@idest
	spl	1	,MARK
	spl	1	,MARK*2
	mov.i	<boot	,{sptr
	mov.i	<boot	,{sptr
sptr	jmp	SOFF	,MARK*3

for 27
	dat.f	$0	,$0
rof

iboot	mov.i	{idest	,<idest
	mov.i	{idest	,<idest
	mov.i	{idest	,<idest
	mov.i	{idest	,<idest
	spl	@idest	,MARK*6
idest	div.f	#imp	,LOFF
	sub.f	sptr	,sptr
	dat.f	MARK*5	,MARK*4

for 15
	dat.f	$0	,$0
rof

STEP	equ	4970
TIME	equ	6529
AWAY	equ	6875
HOP	equ	26

; Armadillo
stone	SPL.B	#STEP	, <-STEP
loop	MOV.I	{STEP	, <hit-STEP-HOP
	MOV.I	cbomb	, @-1
	ADD.F	stone	, loop
hit	DJN.F	@-1	, <stone-STEP
	MOV.I	cbomb	, >stone-6
last	DJN.F	-1	, >stone-6
cbomb	DAT.F	<1	, HOP+1

for 0
	dat.f	$0	,$0
rof

IMPN	equ	2667

igo	spl	0	,>1
	mov.i	imp	,igo+IOFF
	add.a	#IMPN+1	,1
	jmp	igo+IOFF-IMPN-1	,MARK
imp	mov.i	#0	,IMPN

;----------------------------------------------
warr	equ	boot

qfac	equ	227
qdec	equ	1163+1

qa	equ	(qfac*(qtab0-1-qptr)+1)
qb	equ	(qfac*(qtab0-qptr)+1)
qc	equ	(qfac*(qtab1-1-qptr)+1)
qd	equ	(qfac*(qtab1-qptr)+1)
qe	equ	(qfac*(qtab1+1-qptr)+1)
qf	equ	(qfac*(qtab2-qptr)+1)

qtime	equ	19
qstep	equ	-19
qgap	equ	15

qdecode mul.b  *q1,          qptr
q0      sne    <qtab0,       @qptr
q1      add.b  qtab1,        qptr
q2      mov    qtab2,        @qptr
qptr    mov    qtab2,        *qdec
        add    #qstep,       qptr
        djn    q2,           #qtime
        jmp    warr,         qc
qtab1   dat    4000,         qd
        dat    4000,         qe

qscan   sne    qptr+qdec*qe, qptr+qdec*qe+qe
        seq    <qtab1+1,     qptr+qdec*(qe-1)+qe-1
        jmp    qdecode,      }q1
        sne    qptr+qdec*qb, qptr+qdec*qb+qd
        seq    <qtab0,       qptr+qdec*(qb-1)+qd
        jmp    qdecode,      {qdecode
        sne    qptr+qdec*qa, qptr+qdec*qa+qd
        seq    <qtab0-1,     qptr+qdec*(qa-1)+qd
        djn.a  qdecode,      {qdecode
        sne    qptr+qdec*qf, qptr+qdec*qf+qd
        seq    <qtab2,       qptr+qdec*(qf-1)+qd
        jmp    qdecode,      }qdecode
        sne    qptr+qdec*qc, qptr+qdec*qc+qc
        seq    <qtab1-1,     qptr+qdec*(qc-1)+qc-1
        jmp    qdecode,      {q1
        sne    qptr+qdec*qd, qptr+qdec*qd+qd
        seq    <qtab1,       qptr+qdec*(qd-1)+qd-1
        jmp    qdecode,      <qa
qtab0   jmp    warr,         <qb
qtab2   dat    qgap,         qf

end	qscan

