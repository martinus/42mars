;redcode-tiny
;name TohsEno
;author Roy van Rijn
;strategy TohsEno - onEshoT!
;strategy Not tested, should work though...
;assert 1

	spl #0,#0
	mov 3,<6
	mov 2,<5
	jmp -2,<4
	dat <1,<-10
s	sub #10,2
	jmz -1,@1
	jmp -7,<-10

end s
