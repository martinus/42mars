;redcode
;name BloudBound
;Author Paul Khuong
;Strategy Scans for fangs by the Vampire - last minute work :)
;assert 1

gate	equ	start-54

	dat.f	0,0
	dat.f	0,0
same:	jmp	0,	#0
start:	jmz.f	#0,	<gate
check:	mov.f	@gate,	same
	seq.i	same,	@gate
	jmp	start
	jmp	@gate
end start

