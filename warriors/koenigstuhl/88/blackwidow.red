;redcode
;name Black Widow
;author S.Fernandes
;strategy qscan -> scanner
;assert CORESIZE == 8000

QGAP	equ	1168

qfirst	equ	(qp2+2*qstep)
qdist	equ	qfirst+QGAP
qstep	equ	(QGAP+QGAP)

qi	equ	5
qr	equ	10

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

warr    mov     <sfrom      ,    <sboot
        mov     <sfrom      ,    <sboot
        mov     <sfrom      ,    <sboot
        mov     <sfrom      ,    <sboot
        mov     <sfrom      ,    <sboot
sfrom   jmz     warr        ,    inc+1
sboot   jmp     bloc+2      ,    bloc+10

bloc    equ     6488
step    equ     1712
offset  equ     step*2
sep     equ     7
count   equ     498
target  equ     (shades+9)

loop    add     inc         ,    shades
shades  cmp     offset+sep  ,    offset
aim     mov     shades      ,    target
        mov     sbmb        ,    <target
        djn     loop        ,    #count
sbmb    spl     0           ,    0
clear   mov     cleanup     ,    <target
        djn     clear       ,    <5307
cleanup dat     <2667       ,    <-sbmb-target-7
inc     dat     <step       ,    <step

        end     qscan

