;redcode-94nop
;name Grimoire A wcrb
;author Steve Gunnell
;strategy It's all about summoning and dispelling imps
;strategy And proliferating, don't forget that.
;strategy With a JM QScan
;assert CORESIZE==8000


qfac	equ	6757
qdec	equ	(6893+1)

qa	equ	(qfac*(qtab0-1-qptr)+1)
qb	equ	(qfac*(qtab0-qptr)+1)
qc	equ	(qfac*(qtab1-1-qptr)+1)
qd	equ	(qfac*(qtab1-qptr)+1)
qe	equ	(qfac*(qtab1+1-qptr)+1)
qf	equ	(qfac*(qtab2-qptr)+1)

qstep	equ	10
qgap	equ	85
qtime	equ	11

qdecode	mul.b	*q1	,qptr
q0	sne	<qtab0	,@qptr
q1	add.b	qtab1	,qptr
q2	mov	qtab2	,@qptr
qptr	mov	qtab2	,*qdec
	sub	#qstep	,qptr
	djn	q2	,#qtime
	jmp	warr	,qc
qtab1	dat	4000	,qd
	dat	4000	,qe

qscan	sne	qptr+qdec*qe	,qptr+qdec*qe+qe
	seq	<qtab1+1	,qptr+qdec*(qe-1)+qe-1
	jmp	qdecode		,}q1
	sne	qptr+qdec*qb	,qptr+qdec*qb+qd
	seq	<qtab0		,qptr+qdec*(qb-1)+qd
	jmp	qdecode		,{qdecode
	sne	qptr+qdec*qa	,qptr+qdec*qa+qd
	seq	<qtab0-1	,qptr+qdec*(qa-1)+qd
	djn.a	qdecode		,{qdecode
	sne	qptr+qdec*qf	,qptr+qdec*qf+qd
	seq	<qtab2		,qptr+qdec*(qf-1)+qd
	jmp	qdecode		,}qdecode
	sne	qptr+qdec*qc	,qptr+qdec*qc+qc
	seq	<qtab1-1	,qptr+qdec*(qc-1)+qc-1
	jmp	qdecode		,{q1
	sne	qptr+qdec*qd	,qptr+qdec*qd+qd
	seq	<qtab1		,qptr+qdec*(qd-1)+qd-1
	jmp	qdecode		,<qa
qtab0	jmp	warr		,<qb
qtab2	dat	qgap		,qf

for	16
	dat	0	,0
rof

MARK	equ	}6856
BP0	equ	5167

P0Imp	equ	1143
P0S1	equ	6489
P0S2	equ	2564

P0	spl	@8	, <P0S1
	mov.i	}-1	, >-1
pStone	spl	#0	
	mov	P0B	, >ptr
	add.x	P0I	, ptr
ptr	jmp	P0I-P0Imp*8	, >P0S2-6
P0B	dat	>1	, }1
P0I	mov.i	#P0S2-1	, P0Imp

for	27
	dat	0	,0
rof

warr	spl	1	,MARK
	spl	1	,MARK*2
	spl	1	,MARK*3
	mov.i	{P0	,{1
	spl	BP0	,MARK*4

	spl	second	,<1321
first	mov.i	<1	,{1
	spl	P1E+1+2667	,#P1E+1
	dat	MARK*5	,MARK*6

second	mov.i	<1	,{1
	spl	P1E+1+5334	,#P1E+1


P1S1	equ	>3171
P1S2	equ	}5023
P1S3	equ	935
P1A	equ	4335
P1B	equ	5417
P1C	equ	<7021

P1	spl	@0	, P1S1
	mov.i	}-1	, >-1
	spl	@0	,P1S2
	mov.i	}-1	, >-1
	mov.i	#P1A	,{1
	mov.i	P1B	,P1C
	mov.i	{P1	,<1
P1E	jmz.a	@0	,P1S3

end	qscan

