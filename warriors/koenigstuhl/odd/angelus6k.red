;redcode
;author Lukasz Adamowski
;  (stolen from David Houston ;)
;name Angelus 6k
;assert 1
;       CORESIZE == 6000
;strategy Q^5 -> stone/imp

org	qgo

bdaway	equ	4000
biaway	equ	1831

zero	equ	boot

qtab3	equ	qbomb
qbomb	dat	>qoff, >qc2

;----------------------------------------------------

boot	mov	@bdptr, zero + 5 + bdaway + dboff
	spl	2, <qb1
qtab2	spl	2, <qb2
	spl	1, <qb3
	mov	<bdptr, {bdptr
	mov	<biptr, {biptr
	djn	*bdptr, #5
biptr	jmp	zero + 5 + biaway, imps + 5
bdptr	dat	zero + 5 + bdaway, diamond + 5

;-----------------------------------------------------
; the stone

dstepA	equ	4 * 43
dstepB	equ	-dstepA
dstartA	equ	(diamond + 1 - 1499 * dstepA)
dstartB	equ	(diamond + 3 - 1498 * dstepB)
dstream	equ	-2500
dptr	equ	(dbomb + dboff)
dboff	equ	80

diamond	spl	#dstepA, <dstepB
	mov	dstartA, dstartB
	mov	dptr, *-1	; hit with dat >-1, >1
	add.f	diamond, @-1
	djn.f	-3, <dstream
dbomb	dat	>-1, >1

;-----------------------------------------------------
; the imps
; boring 7-point imps
; in theory, impi can be moved away from main body

istep	equ	5143
istart	equ	impi

imps	spl	#istart, <-20
	sub.f	#-(istep + 1), ijmp
	mov	istart, }imps
ijmp	jmp	istart - 2 * (istep + 1), <1000
impi	mov.i	#-5, istep
	dat	zero - 1, qa1
qtab1	dat	zero - 1, qa2


;-----------------------------------------------------
;partial q^5

qc2	equ	((1 + (qtab3-qptr)*qy) % CORESIZE)
qb1	equ	((1 + (qtab2-1-qptr)*qy) % CORESIZE)
qb2	equ	((1 + (qtab2-qptr)*qy) % CORESIZE)
qb3	equ	((1 + (qtab2+1-qptr)*qy) % CORESIZE)
qa1	equ	((1 + (qtab1-1-qptr)*qy) % CORESIZE)
qa2	equ	((1 + (qtab1-qptr)*qy) % CORESIZE)
qz	equ	1908
qy	equ	4043
; qy * (qz-1) = 1

;q0 mutation
qgo	sne	qptr + qz*qc2, qptr + qz*qc2 + qb2
	seq	<qtab3, qptr + qz*(qc2-1) + qb2
	jmp	q0, }q0
	sne	qptr + qz*qa2, qptr + qz*qa2 + qb2
	seq	<qtab1, qptr + qz*(qa2-1) + qb2
	jmp	q0, {q0
	sne	qptr + qz*qa1, qptr + qz*qa1 + qb2
	seq	<(qtab1-1), qptr + qz*(qa1-1) + qb2
	djn.a	q0, {q0
;q1 mutation
	sne	qptr + qz*qb3, qptr + qz*qb3 + qb3
	seq	<(qtab2+1), qptr + qz*(qb3-1) + (qb3-1)
	jmp	q0, }q1
	sne	qptr + qz*qb1, qptr + qz*qb1 + qb1
	seq	<(qtab2-1), qptr + qz*(qb1-1) + (qb1-1)
	jmp	q0, {q1
;no mutation
	sne	qptr + qz*qb2, qptr + qz*qb2 + qb2
	seq	<qtab2, qptr + qz*(qb2-1) + (qb2-1)
	jmp	q0
;qz mutation
	seq	>qptr, qptr + qz + (qb2-1)
	jmp	q2, <qptr
;q0 mutation
	seq	qptr + (qz+1)*(qc2-1), qptr + (qz+1)*(qc2-1) + (qb2-1)
	jmp	q0, }q0
	seq	qptr + (qz+1)*(qa2-1), qptr + (qz+1)*(qa2-1) + (qb2-1)
	jmp	q0, {q0
	seq	qptr + (qz+1)*(qa1-1), qptr + (qz+1)*(qa1-1) + (qb2-1)
	djn.a	q0, {q0
;no mutation
	jmz.f	boot, qptr + (qz+1)*(qb2-1) + (qb2-1)

qoff	equ	-87
qstep	equ	-7
qtime	equ	14

q0	mul.b	*2, qptr
q2	sne	{qtab1, @qptr
q1	add.b	qtab2, qptr
	mov	qtab3, @qptr
qptr	mov	qbomb, }qz
	sub	#qstep, qptr
	djn	-3, #qtime
	jmp	boot

end
