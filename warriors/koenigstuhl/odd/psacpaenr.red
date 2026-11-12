;redcode
;name Psacpaenr
;author Lukasz Adamowski
;strategy 79 characters
;strategy paper -> JMZ-scanner -> coreclear
;assert 1

	FOR	3		; 4
	spl	1		; 4
	ROF			; 3
x	FOR	3		; 5
	spl	(585*x-3213)*x/2+2277	; 24
	mov	>-1,	}-1	; 10
	ROF			; 3
	jmz	#3,	>9	; 8
	mov	*-1,	<8	; 9
	dat		0	; 4
	spl	#2		; 5

; steps: 963, 234, 90
