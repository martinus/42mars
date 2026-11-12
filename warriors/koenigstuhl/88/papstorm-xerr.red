;redcode
;name Papillion Storm xerr
;strategy qscan -> paper/stone
;strategy Stone is Moonstone like
;author Steve Gunnell
;assert CORESIZE==8000

;kill Papillion Storm
;password whdzmftham

MARK	equ	3100
STEP1	equ	7999-942
HOP	equ	19

S	equ	61
F	equ	183

	MOV	S	,<-S
incr	MOV	S	,<-S
start	SPL	0
loop	MOV	<incr+F	,3-F
	ADD	incr	,loop
	DJN	loop	,<2236
	JMN	-1	,683
	JMP	0	,<0-19

src	dat	#0	,#0
fire	spl	1	,<MARK*2
	mov	<src	,<dst
	spl	1	,<MARK*3
	mov	<src	,<dst
	spl	1	,<MARK*4
for 0
	spl	@dst	,<MARK
rof
dst	spl	@0	,3685
	mov	<src	,<dst
	sub	<0	,0
	mov	<en	,<1
	jmp	@0	,538
;	mov	#8	,0
	add	#8	,0
	mov	<-1	,<1
p1	spl	@0	,STEP1
	mov	b1	,<p1
	mov	<-MARK	,<MARK
	mov	<-MARK	,<MARK
	jmz	-6	,-6
b1	dat	<1143	,<2667
en	dat	#0	,#0

for	MAXLENGTH-CURLINE-39
	dat	#0	,#0
rof

; qscan - 36 scans in 48 instructions

QGAP	equ	2078

qfirst	equ	(qp2+2*qstep)
qdist	equ	qfirst+QGAP
qstep	equ	(QGAP+QGAP)

qi	equ	7
qr	equ	8

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
	cmp	qdist+qd+qd+qc,qfirst+qd+qd+qc
q3	djn	qslower, #qp3

	jmz	fire, qdist+qe+qd+qc+10

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
	jmp	fire

	end	qscan

