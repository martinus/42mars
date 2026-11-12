;redcode-94tiny
;name Paper?
;author Roy van Rijn
;strategy Just guessed some constants, 
;strategy big ones (no forward clears...) ;strategy If they do backwards 
;strategy we have to hop over that :) 
;assert 1

s	add #8,0
	mov <-1,{2
	jmn.b -1,s
c	spl 568,<117
	mov 4,<274
	mov 3,<41
	add #784,c
	jmp s,>35
        end
