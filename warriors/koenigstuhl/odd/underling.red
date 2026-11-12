;redcode-94
;name Underling
;strategy 0.33c quadratic scan
;strategy Then, hide in the cell just
;strategy before Counter, while
;strategy modifying the cell just
;strategy after Counter
;assert 1

org	scan

	for	0;189
	dat	0, 0
	rof

	add.ab	#0, scan
scan	seq	match, <tail + 200
	jmp	-2, }-2
	add.b	@scan, scan
	sub.ab	#2, scan
	mov	spin, @scan
	spl	1
	spl	1
	jmp	@scan
spin	jmp	#0, <5
match	mov	2, {2

tail	i for	0
	rof

end
