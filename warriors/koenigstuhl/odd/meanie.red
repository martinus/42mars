;redcode-94
;name Meanie
;strategy 0.33c quadratic scan
;strategy Boot meanie module opposite
;strategy counter.
;strategy Meanine is a bomber that
;strategy drops bombs that may cause
;strategy processes to modify counter!
;strategy Isn't that mean!
;strategy Meanie eventually hides
;strategy in front of counter.
;assert 1

org	scan

	add.ab	#0, scan
scan	seq	match, <tail + 200
	jmp	-2, }-2
	add.b	@scan, scan
	add.ab	#moff + (spin - meanie), scan
	mov.i	<bptr, <scan
	djn	-1, #(spin - meanie) + 1
bptr	jmp	@scan, spin + 1

match	mov	2, {2

	for	100
	dat	0, 0
	rof

gate	equ	(meanie - 20)

step	equ	5 * 43

moff	equ	4000

meanie	mov	bomb, meanie - 1 + step
	add	#step, -1
	jmz.f	meanie, gate
	seq	#0, #0
bomb	dat.f	#0, *-5
	mov	spin, @1
	jmp	@0, }meanie - moff + 4
spin	jmn.b	*-1, -2

tail	i for 0
	rof

end
