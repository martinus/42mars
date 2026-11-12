;redcode-nenad
;author inversed
;name Shot++
;strategy P^3 switcher:
;strategy Quicksilver-like stone
;strategy Moore-style paper
;strategy Oneshot
;assert 1

;Minimal impstep is 6397 - 13pt imps
;So I expect paper/stones and scanners
;Stone/imps are possible too
;Paper/imps are feasible, but ineffective
;And of course I expect p-warriors
;P^3 table isn't optimized, but I think it should work fine

bdist	equ	2100	;paper and stone
bdo	equ	1900	;oneshot

x0	equ	start
org	start

;; Boot

stone	add	#8,		bps
paper	spl	1,		0
	spl	1,		0
	spl	1,		0

	mov	<bps,		{bps
bps	jmp	x0+bdist+8,	to+8

;; Paper

ofs1	equ	(4378)
bofs1	equ	(2657)
bofs2	equ	(5319)
bofs3	equ	(4030)

to	spl	ofs1,	{from
	mov	}from,	}to
	mov	bomb,	>bofs1
	mov	bomb,	}bofs2
from	mov	@to+8,	}to
	mov	bomb,	>bofs3
	jmz	to,	*from
bomb	dat	<6397,	<2*6397

;; Stone

shop	equ	2699
stime	equ	4140
sdjn	equ	2813
zstn	equ	6539	;(hit-shop*stime)

ss0	spl	#0		,	0
sloop	mov	sbomb		,	@sptr
hit	add	#shop*2		,	sptr
sptr	mov	sbomb		,	*zstn
	jmp	sloop		,	0
	dat	0		,	0
	dat	0		,	0
sbomb	dat	shop		,	>1

	for	20
	dat	0,	0
	rof

;; Oneshot

step	equ	45	;increment (x.......o......o......)
hop1	equ	15	;             hop1
hop2	equ	15	;                     hop2
zofs	equ	step

gap1	equ	5
gap2	equ	11
cptr	equ	(kill-gap1-1)

loop	add	loop-gap2-5,	ptr
	mov	loop-gap2-6,	*ptr
ptr	sne	@zofs,		zofs+hop1+hop2
	jmn.a	loop,		loop
	mov.ab	ptr,		loop-gap2-7-gap1
	jmp	loop-gap2-5,	0

kill	dat	1,	hop1
cs0	spl	#step,	step
cloop	mov	*kill,	>cptr
	mov	*kill,	>cptr
	djn.a	cloop,	}cs0
	dat	0,	0

onecpy	add.a	#gap2+12,bpo
onesh	mov	<bpo,	{bpo
	mov	<bpo,	{bpo
	mov	<bpo,	{bpo
	mov	<bpo,	{bpo
	mov	<bpo,	{bpo
	mov	<bpo,	{bpo
	djn	onecpy,	#2

bpo	spl	x0+bdo+6,	kill+6
	mov.i	#0,	bpo
	dat	0,	0


	for	65
	dat	0,	0
	rof

;; Switcher

ploc	equ	231

start	ldp.a	#0,	pres
	ldp.a	#ploc,	ptab
	mod.ba	*pres,	ptab
	stp	*ptab,	#ploc	; S  L  W  T
ptab	jmp	}0,	2535	; 0  1  0  0
	dat	stone,	1066	; 1  2  0  1
	dat	stone,	2327	; 2  3  0  2
	dat	onesh,	2538	; 3  4  3  3
	dat	onesh,	1069	; 4  5  3  4
	dat	onesh,	1070	; 5  6  4  5
	dat	onesh,	1071	; 6  7  5  6
	dat	onesh,	1072	; 7  8  6  7
	dat	paper,	1074	; 8 10  8  9
	dat	paper,	2335	; 9 11  8 10
	dat	paper,	866	;10 12  8 11
	dat	paper,	672	;11  0  9 12
	dat	paper,	1050	;12  0 10  0

pres	dat	0,	14	;Loss
	dat	0,	13	;Win
	dat	0,	15	;Tie

