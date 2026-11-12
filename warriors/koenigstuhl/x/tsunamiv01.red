;redcode-94x
;name Tsunami v0.1
;author Ian Oversby
;strategy One-shot scanner
;assert CORESIZE==55440

gate1		equ (gate-3)

org	loop

for 90
	dat.f	$0,	$0
rof

gate	dat.f	#-25,	bptr-gate1+3
	spl.b	#-20,	#20
b1	spl.b	#310,	#300
loop	add.f	step,	@scan
scan	sne.i	*b1,	@b1
	djn.f	loop,	<-800
step	spl.b	#20,	#20
cloop	mov.i	@bptr,	>gate1
bptr	djn.b	cloop,	{b1

end

