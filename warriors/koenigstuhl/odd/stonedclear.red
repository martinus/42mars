;redcode
;name Stone into D-Clear
;author Lukasz Adamowski
;assert 1

h	equ	49
zofs	equ	2*h+1
cnt	equ	1151

inc	spl	#0,	0
ptr	mov	bomb,	>zofs
	mov	bomb,	@ptr
	add	#2*h,	ptr
	djn	ptr,	#cnt
	mov	d,	ptr+2
	jmp	inc,	}-2
d	mov	bomb,	>zofs+4
bomb	dat	<2667,	h

end ptr

Bye!

-= "War is a problem, never a solution" =-
-= "Wojna jest problemem, a nie rozwiazaniem" =-

----------------------------------------------------
Nie panikuj! Ju¿ 26.10 najbardziej zakrêcona komedia roku
"Autostopem przez Galaktykê" na DVD!
http://klik.wp.pl/?adr=http%3A%2F%2Fadv.reklama.wp.pl%2Fas%2Fapg.html&sid=539


