;redcode-94nop
;name Wrapduo xkyv
;author Steve Gunnell
;strategy Qscan -> Dual tiny warrior launcher
;strategy Looks like a weird chunk of Tolypeutes' qscan and a oneshot
;assert CORESIZE==8000


qfac	equ	1033
qdec	equ	(697+1)

qa	equ	(qfac*(qtab0-1-qptr)+1)
qb	equ	(qfac*(qtab0-qptr)+1)
qc	equ	(qfac*(qtab1-1-qptr)+1)
qd	equ	(qfac*(qtab1-qptr)+1)
qe	equ	(qfac*(qtab1+1-qptr)+1)
qf	equ	(qfac*(qtab2-qptr)+1)

qstep	equ	(1+3)
qgap	equ	(43+50)
qtime	equ	(qgap/qstep)+7

qdecode	mul.b	*q1		,	qptr
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

for MAXLENGTH-CURLINE-46
	dat.f	0	,0
rof
warr	spl	1	,A0+16
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	mov.i	<warr	,<throw
	djn.b	@throw	,#1
	add.ab	#2676	,throw
	mov.ab	#1	,-2
	djn.b	warr	,#2
throw	dat	}4000	,}3117


;    Warrior B
B0:	
; Block 174 source tolypeutes.red 
	SNE.I 	$1348	,$-1043
	SEQ.I 	<16	,$1242
	JMP.F 	$90	,}90
	SNE.I 	$2239	,$-152
	SEQ.I 	<36	,$2133
	DJN.A 	$87	,{87
	SNE.I 	$2006	,$-385
	SEQ.I 	>34	,$-281
	JMP.F 	$84	,{84
	SNE.I 	$-3103	,$2506
	SEQ.I 	<18	,$-3209
	JMP.F 	$81	,{85
	SNE.I 	$450	,$-1941
	SEQ.I 	<17	,$344
	JMP.F 	$78	,}82
	SNE.I 	$1867	,$-524

;    Warrior A
A0:	
; Block 96 source chop16-lwkv.red 
	MOV.I 	$5	,>-7
	SEQ.I 	$-22	,$-16
	MOV.B 	$-1	,@-2
	SUB.F 	$2	,$-2
	JMN.B 	$-4	,@-4
	SPL.F 	#16	,>16
	MOV.I 	$2	,>-6
	DJN.F 	$-1	,>-7
	DAT.F 	$1	,$12
	DAT.F 	$0	,$0
	DAT.F 	$0	,$0
	SPL.F 	#16	,>16
	DAT.F 	$0	,$0
	DAT.F 	$0	,$0
	DAT.F 	$0	,$0
	DAT.F 	$0	,$0

end	qscan

