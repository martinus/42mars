;redcode
;name thE caSing
;author Lukasz Adamowski
;strategy 52 characters
;strategy JMZ-scanner -> multipass coreclear
;assert 1

a	jmz	#s,	>99	; 10
	mov	*a,	<98	; 9
	jmp	a		; 4
	FOR	50		; 5
	dat	0,	0	; 6
	ROF			; 3
s	spl	#1-a		; 8
	dat		-101	; 7
