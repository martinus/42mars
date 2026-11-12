;redcode-94
;name Train
;author Erki
;assert CORESIZE == 8000

NENGINES equ 62

	ORG boot
first

boot
	mov	imp,			4000
	spl	3999,			<1568
	spl	3998,			}2365

b2	spl	1,			>3648
	spl	1,			>4896
	spl	1,			<5624
	spl	1,			}6217
	spl	1,			{7836
	mov.I	-1,			#0

launch
	jmp	imp,			}0
	dat	0,			{5648
imp
x	FOR MAXLENGTH-(imp-first)
	mov.I	#0,			1
	ROF
	END
