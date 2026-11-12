;redcode-94nop
;name Alternating Raisins swhg
;author Steve Gunnell
;strategy Do a qscan then one of two semi evolved components
;strategy Looks like a paper and a scanner.
;strategy Based on shapeshifter
;assert CORESIZE==8000


	spl	1	,<qb1
qtab2	spl	1	,<qb2
	spl	1	,<qb3
	dat.f	$0	,$0

; post bomb component
B0:
; Block 124 source xnfaa-nezc.red 
	MOV.I 	<-143	,$143
	SPL.F 	$1	,{0
	SPL.F 	$1	,}2345
	SPL.F 	$1	,}3456
	SPL.F 	@0	,>535
	MOV.I 	}-1	,>-1
	SPL.F 	$3875	,$0
	MOV.I 	>-1	,}-1
	MOV.I 	$3	,>-401
	MOV.I 	<-3	,<1
	DJN.F 	@0	,>-2840
	DAT.F 	>-2666	,>2667

null	dat.f	$0	,$0

for	20
	dat.f	$0	,$0
rof

;-------qscan	constants----------------------
zero	equ	qbomb
qtab3	equ	qbomb

qbomb	dat.f	>qoff	,>qc2

	dat.f	zero-1	,qa1
qtab1	dat.f	zero-1	,qa2

dvins	mov	101	,{1	; pretty good bomb

qc2	equ	((1+(qtab3-qptr)*qy)%CORESIZE)
qb1	equ	((1+(qtab2-1-qptr)*qy)%CORESIZE)
qb2	equ	((1+(qtab2-qptr)*qy)%CORESIZE)
qb3	equ	((1+(qtab2+1-qptr)*qy)%CORESIZE)
qa1	equ	((1+(qtab1-1-qptr)*qy)%CORESIZE)
qa2	equ	((1+(qtab1-qptr)*qy)%CORESIZE)

qz	equ	(2731+1)
qy	equ	7171

qgo	sne	qptr+qz*qc2	,qptr+qz*qc2+qb2
	seq	<qtab3	,qptr+qz*(qc2-1)+qb2
	jmp	q0	,}q0
	sne	qptr+qz*qa2	,qptr+qz*qa2+qb2
	seq	<qtab1	,qptr+qz*(qa2-1)+qb2
	jmp	q0	,{q0
	sne	qptr+qz*qa1	,qptr+qz*qa1+qb2
	seq	<(qtab1-1)	,qptr+qz*(qa1-1)+qb2
	djn.a	q0	,{q0
	sne	qptr+qz*qb3	,qptr+qz*qb3+qb3
	seq	<(qtab2+1)	,qptr+qz*(qb3-1)+(qb3-1)
	jmp	q0	,}q1
	sne	qptr+qz*qb1	,qptr+qz*qb1+qb1
	seq	<(qtab2-1)	,qptr+qz*(qb1-1)+(qb1-1)
	jmp	q0	,{q1
	sne	qptr+qz*qb2	,qptr+qz*qb2+qb2
	seq	<qtab2	,qptr+qz*(qb2-1)+(qb2-1)
	jmp	q0
	seq	>qptr	,qptr+qz+(qb2-1)
	jmp	q2	,<qptr
	seq	qptr+(qz+1)*(qc2-1)	,qptr+(qz+1)*(qc2-1)+(qb2-1)
	jmp	q0	,}q0
	seq	qptr+(qz+1)*(qa2-1)	,qptr+(qz+1)*(qa2-1)+(qb2-1)
	jmp	q0	,{q0
	seq	qptr+(qz+1)*(qa1-1)	,qptr+(qz+1)*(qa1-1)+(qb2-1)
	djn.a	q0	,{q0
	jmn.f	q0	,qptr+(qz+1)*(qb2-1)+(qb2-1)

	add.f	adju	,dest
boot2:	spl	1	,<4000
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	mov.i	<dest	,{dest
	djn.b	*1	,#1
dest	div.f	#5097	,#B0+12
adju	dat	#6957	,A0-B0

; Second component
A0:
; Block 123 source hazoptF-ibmx.red 
	MOV.I 	$5	,>-11
	SEQ.I 	$-30	,$-20
	MOV.B 	$-1	,@-2
	SUB.F 	$2	,$-2
	JMN.B 	$-4	,@-4
	SPL.F 	#20	,>20
	MOV.I 	$2	,>-6
	DJN.F 	$-1	,>-7
	DAT.F 	}-2666	,$14
	MOV.I 	$-1	,<9
	MOV.I 	{-1	,<8
	MOV.I 	{-2	,<7

qoff	equ	-87
qstep	equ	-7
qtime	equ	14

q0	mul.b	*2	,qptr
q2	sne	{qtab1	,@qptr
q1	add.b	qtab2	,qptr
	mov	qtab3	,@qptr
qptr	mov	qbomb	,}qz
	sub	#qstep	,qptr
	djn	-3	,#qtime
	jmp	boot2	,<400

END qgo

