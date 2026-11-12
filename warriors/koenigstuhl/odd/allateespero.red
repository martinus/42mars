;redcode-RFT22
;name alla te espero
;author el kauka
;strategy oneshot -> jjd-clear
;strategy handshaker (king)
;assert 1

org hs


	pin	765
hs	nop	0,	0
	nop	0,	0
	stp	#77,	#223
	stp	#77,	#223
	jmp	loop

	for 9
	dat	0,	0
	rof

inc	dat	309,	309
loop	add.f	inc,	ptr
	seq.i	}ptr,	>ptr	;anti stone trick
ptr	sne.i	-3,	3
	djn.f	loop,	<-345
	jmp	attack+1

for 25
	dat	0,	0
rof
		
	dat	<50,	}-100
	jmp	#50,	{-100
attack	jmp	#50,	-100
	mov.i	@1,	}ptr
	djn.b	-1,	<attack

end




