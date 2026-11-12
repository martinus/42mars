;redcode
;name Not Yeti B imqb
;author Steve Gunnell
;strategy Winter Werewolf derivative
;strategy With one of JM's qscans
;assert CORESIZE==8000

; qscan - 36 scans in 48 instructions

QGAP	equ	2567

qfirst	equ	(qp2+2*qstep)
qdist	equ	qfirst+QGAP
qstep	equ	(QGAP+QGAP)

qi	equ	4
qr	equ	11

qbomb	dat	<qi/2-qi*qr, <qi*qr-qi/2

qa	equ	qstep*16
qb	equ	qstep*5+2
qc	equ	qstep*10
qd	equ	qstep*2
qe	equ	qstep*1

qscan	cmp	qdist+qc, qfirst+qc
	jmp	qfast, <qa
	cmp	qdist+qe+qd, qfirst+qe+qd
qp1	jmp	<qfast, <qc
qp2	cmp	qdist, qfirst
qp3	jmp	qskip, <qe

	cmp	qdist+qb, qfirst+qb
q1	djn	qfast, #qp1

	cmp	qdist+qd+qc, qfirst+qd+qc
	jmp	qslow, <qfirst+qd+qc+4
	cmp	qdist+qd+qb, qfirst+qd+qb
x1	jmp	qslow, <q1
	cmp	qdist+qc+qc, qfirst+qc+qc
q2	djn	qslow, #qp2
	cmp	qdist+qd, qfirst+qd
	jmp	qslow, <qfast
	cmp	qdist+qa, qfirst+qa
	jmp	q1, <q1

	cmp	qdist+qa+qd, qfirst+qa+qd
	jmp	x1, <q1
	cmp	qdist+qc+qb, qfirst+qc+qb
	jmp	q2, <q1
	cmp	qdist+qe+qd+qc,qfirst+qe+qd+qc
	jmp	qslower, <qfirst+qe+qd+qc+4
	cmp	qdist+qe+qd+qb,qfirst+qe+qd+qb
	jmp	qslower, <q1
	cmp	qdist+qe+qc+qc,qfirst+qe+qc+qc
	jmp	qslower, <q2
	cmp	qdist+qd+qd+qc,qfirst+qd+qd+qc
q3	djn	qslower, #qp3
	cmp	qdist+qe+qc, qfirst+qe+qc
	jmp	<qfast, <q2
	cmp	qdist+qd+qd, qfirst+qd+qd
	jmp	<qfast, <q3
	cmp	qdist+qd+qd+qb,qfirst+qd+qd+qb
	slt	<q3, <q1

	jmz	warr, qdist+qe+qd+qc+10

qslower	add @q3, @qslow
qslow	add @q2, qkil
qfast	add @q1, @qslow

qskip	cmp <qdist+qstep+50, @qkil
	jmp	qloop, <1234

	add	#qdist-qfirst, qkil
qloop	mov qbomb, @qkil
qkil	mov <qfirst+qstep+50, <qfirst
	sub #qi, @qloop
	djn qloop, #qr+2


STEP	equ	7954
TIME	equ	7925
BOOT	equ	560
PTR	equ	(2+6)

warr	mov	<from	,<to
	mov	<from	,<to
	mov	<from	,<to
	mov	<from	,<to
	mov	<from	,<to
	mov	<from	,<to
to	spl	@0	,BOOT
	mov	<from	,<to
	sub	#2+PTR	,to
	mov	kill	,@to
	sub	to	,to
from	dat	#0	,#hold+1

stun	SPL     0	,<-3+STEP-PTR
main	MOV     hold	,@3
	MOV     stun	,<2
	sub     #STEP	,@-1
	JMP	main	,(STEP+1)*TIME
	MOV     @-4	,<PTR
hold	JMP     -1	,1

kill	DAT	<-4-PTR	,#0

	end	qscan

