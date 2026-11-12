;redcode
;name Mythos'88
;author S.Fernandes
;strategy hydra/paper
;strategy paper from Zygote
;strategy hydra from Nemesis
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

MARK    equ     <700
mloc    equ     5000
ploc    equ     413

warr    spl     1           ,    MARK*4
        spl     1           ,    MARK*5
        spl     1           ,    MARK*6
        mov     <micro+8    ,    <mboot
mboot   spl     @0          ,    mloc
        mov     <paper      ,    <pboot
pboot   jmp     @0          ,    ploc

paper   add     #8          ,    8
        mov     <paper      ,    <copy
copy    spl     @0          ,    4995
        mov     bomb        ,    <copy
        mov     bomb        ,    <paper+8
        jmz     paper       ,    paper
bomb    dat     <2667       ,    <5334
        dat     <2667       ,    <5334

first   equ     596
step    equ     4109

micro   spl    0            ,    <spr
        mov    0            ,    <spr
spr     mov    dec          ,    first
        add    #step        ,    spr
        mov    micro        ,    @spr
        djn    @spr         ,    <5649
        dat    #0           ,    #0
dec     djn    -2           ,    #92
        end    qscan

