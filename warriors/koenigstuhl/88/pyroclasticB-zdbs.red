;redcode
;name Pyroclastic Flow B zdbs
;author Steve Gunnell
;strategy Incendiary Bomber like Stillborn by mjp
;strategy Qscan from John Metcalf
;assert CORESIZE==8000

; qscan - 36 scans in 48 instructions

QGAP	equ	2818

qfirst	equ	(qp2+2*qstep)
qdist	equ	qfirst+QGAP
qstep	equ	(QGAP+QGAP)

qi	equ	4
qr	equ	13

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

warr	mov	<src	,<dst
	djn	-1	,#9
dst	spl	@0	,2260
	sub	-1	,-1
src	dat	<4000	,#bmov+1

; STEP	primary step of bomber
; DD	distance of spl from mov part of incendiary
; D	distance of clear from gate
; the carpet length of the incendiary is DD-D

STEP	equ	7479
N	equ	1560
DD	equ	5802
D	equ	(DD-6)
IMPNUM	equ	5091

tgt	equ	(realtgt-DD)

bspl	spl	0	,	<-D
	add	#STEP	,	1
	mov	bspl	,	@tgt-(N*STEP)
	mov	bmov	,	@-1
realtgt	jmz	-3	,	@0
	mov	2	,	<-2
	djn	-1	,	<4290
		dat	<-D-1-IMPNUM	,<-D-1
bmov	mov	DD	,	<DD

	end	qscan

