;redcode
;name Water
;author Lukasz Adamowski
;strategy Impy imp ;]
;assert CORESIZE==8000 
; MAXLENGTH==8 && MINDISTANCE==8

x	FOR	7
	mov	$8-x,	$(8-x)*1001
	ROF
	mov.i	#1,	*0

