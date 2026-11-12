;redcode
;name Bacon
;author Sascha Zapf
;assert 1



step    equ 4
time	equ 39
dstream equ -20

start	spl		#step*2, < step*2
		mov.i	hit-(2*step*time),   hit-(2*step*time)+step
		mov.i	bomb,	*-1
hit		add.f   start,  @-1
		djn.f   @-2,   <dstream
bomb    dat.f	>-1,>1		




	end