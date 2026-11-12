;redcode-94x
;name xd100 test
;author David Houston
;assert CORESIZE==55440
;strategy quickscan -> stone/imp
;strategy based on Devilish 2.02
;strategy but with cool trick!

org qgo

;pointer to instruction #0
zero	equ	qbomb

;-----------------------------------------------------
qtab3	equ	qbomb
qbomb	dat	>qoff, >qc2

;-----------------------------------------------------
; the boot

bdaway	equ	20000
biaway	equ	37311
;biaway	equ	39999 + dstep * 50

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

dstep	equ	18796
dstream	equ	13550
dptr	equ	(dbomb + dboff)
dboff	equ	(-80)

diamond	spl	#dstep, <-dstep
	mov	dstep, 2 - 2 * dstep
	mov	dptr, *-1	; hit with dat >-1, >1
	add.f	diamond, @-1
	djn.f	-3, <dstream
dbomb	dat	>-1, >1

;-----------------------------------------------------
; the imps
; boring 17-point imps
; in theory, impi can be moved away from main body

;istep	equ	2667
istep	equ	35873
istart	equ	(imps + 4)

imps	spl	#istart, <-20
	sub.f	#-(istep + 1), ijmp
	mov	istart, }imps
ijmp	jmp	istart - 2 * (istep + 1), <-10000
impi	mov.i	#-5, istep
;impi	mov.i	#istep, *0

	dat	zero - 1, qa1
qtab1	dat	zero - 1, qa2

;-----------------------------------------------------
; this core intentionally left blank

	for	42
	dat	0, 0
	rof

;-----------------------------------------------------
;extended Q^4 scan

qc2	equ	((1 + (qtab3-qptr)*qy) % CORESIZE)
qb1	equ	((1 + (qtab2-1-qptr)*qy) % CORESIZE)
qb2	equ	((1 + (qtab2-qptr)*qy) % CORESIZE)
qb3	equ	((1 + (qtab2+1-qptr)*qy) % CORESIZE)
qa1	equ	((1 + (qtab1-1-qptr)*qy) % CORESIZE)
qa2	equ	((1 + (qtab1-qptr)*qy) % CORESIZE)
qz	equ	5394
qy	equ	257
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

qoff	equ	-157
qstep	equ	-7
qtime	equ	24

q0	mul.b	*2, qptr
q2	sne	{qtab1, @qptr
q1	add.b	qtab2, qptr
	mov	qtab3, @qptr
qptr	mov	qbomb, }qz
	sub	#qstep, qptr
	djn	-3, #qtime
	jmp	boot

end

