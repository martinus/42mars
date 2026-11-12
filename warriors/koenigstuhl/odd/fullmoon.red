;redcode
;name Full Moon
;author Lukasz Adamowski
;strategy P-switcher
;strategy Includes qscan, paper, stone and clear
;assert 1

pstr	equ	404
strs	equ	10

think	ldp	#0,	tres
	ldp.a	#pstr,	tstr
	jmz	tstr,	<tres
tres	nop	}tstr,	$0
	mod.a	#strs,	tstr
	stp.ab	tstr,	#pstr
tstr	jmp	@0,	clear
paper	spl	1,	qscan
	spl	1,	paper
	spl	1,	stone-1
	jmp	silk,	stone-4
	dat	$0	paper+1
	nop	}sste,	stone-2
	nop	}sste,	paper+2
	nop	}sste,	stone-3
	nop	}sste,	stone

sbmb	equ	sste
strg	equ 	stone

stone	spl	#-1,	{strg
	add.a	sste,	strg
	mov	sbmb,	{strg
	mov	sbmb,	{strg
	add.a	sste,	strg
	djn	$-2,	{strg

sste	dat	$7+2,	$0

qscan	sne	{900-40,	{900
	seq	{900+40,	{100
	mov.f	-1,	>ctrg
qcnt	FOR	20
	sne	{900-40+qcnt*1700,	{900+qcnt*1700
	seq	{900+40+qcnt*1700,	{100
	mov.f	-1,	>cbmb
	ROF
ctrg	equ	clear-4

clear	spl	#0,	<ctrg+1
	mov	cbmb,	{ctrg
	mov	cbmb,	{ctrg
	djn	-1,	ctrg
	mov.f	<cbmb,	ctrg

cbmb	dat	$0,	$1

silk	spl	$9*11*13*17+3,	$0
	mov	>-1,	}-1
	spl	$7*8*9+1,	$0
	mov	>-1,	}-1
	spl	$44,	$0
	mov	>-1,	}-1
	mov	}-10,	{0
	djn	$-1,	{-1

	end	think

