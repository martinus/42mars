;redcode
;name ssoBeht
;author Sascha Zapf
;assert CORESIZE==8000
;strategy Oneshot

	SUB 3,1
z	SNE 633,624
	djn -2,#416
	SPL #(a=6768),<a
	MOV @2,>z
	MOV @1,>z
	DJN.f -2,{2
	DAT #-10,8
	SPL #-10,8

	end 1
