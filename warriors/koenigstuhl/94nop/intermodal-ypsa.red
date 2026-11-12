;redcode-94nop
;name Intermodal A ypsa
;author Steve Gunnell
;strategy A modern Freight Train
;strategy With a JM QScan
;assert CORESIZE==8000


qfac	equ	4551
qdec	equ	(951+1)

qa	equ	(qfac*(qtab0-1-qptr)+1)
qb	equ	(qfac*(qtab0-qptr)+1)
qc	equ	(qfac*(qtab1-1-qptr)+1)
qd	equ	(qfac*(qtab1-qptr)+1)
qe	equ	(qfac*(qtab1+1-qptr)+1)
qf	equ	(qfac*(qtab2-qptr)+1)

qstep	equ	5
qgap	equ	29
qtime	equ	19

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

for 11
	DAT.F	$0	,$0
rof

STEP	equ	882
TIME	equ	2420
SGAP	equ	5
AWAY	equ	2787
MARK	equ	2756
IMPN	equ	2667
ISEP	equ	5714
IWAY	equ	5983

db	dat	<2667	,<1

dd	equ	4+SGAP
stone	mov.i	<dd+1+(2*TIME)	,send+(STEP*TIME)
	spl	-1	,<send-STEP
	add.f	send	,-2
send	djn.f	-2	,<0-STEP
sboot	mov.i	db	,@sptr
	sub.ab	#dd	,sptr
sptr	spl	@0	,AWAY
	mov.i	stone	,>sptr
	mov.i	stone+1	,>sptr
	mov.i	stone+2	,>sptr
	mov.i	stone+3	,>sptr
	div.f	sptr	,sptr
	dat	>MARK	,>MARK*2

for MAXLENGTH-CURLINE-15
	DAT.F	$0	,$0
rof

;;--------------------- Boot the imp/launch -------------------------

warr	spl	sboot	,>MARK*6
iboot   MOV.I   <ipos,  {iptr
        MOV.I   <ipos,  <iptr
        MOV.I   <ipos,  <iptr
        MOV.I   <ipos,  <iptr
        MOV.I   <ipos,  <iptr
        SPL.B   @iptr,  >MARK*3

iptr    DIV.F   #spin+IWAY+ISEP+1,       #spin+IWAY
datone  DAT.F   >MARK*4	,>MARK*5
impy	equ	imp+ISEP

spin    SPL.B   #IMPN+1,  >prime
prime   MOV.I   impy,   impy
        ADD.F   spin,   jump
jump    JMP.B   impy-IMPN-1, <MARK
imp     MOV.I   #IMPN,    *0

ipos    DAT.F   $0,     $0

end	qscan

