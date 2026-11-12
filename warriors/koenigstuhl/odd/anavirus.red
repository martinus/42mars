;redcode-94
;name ANA VIRUS
;author Ana
;assert 1

        org     start
	
midat	dat		0, #51

index 	for 2 ;maxins 1000
		dat		0, 0
rof		
		
bomb2	mov		midat,>midat	
		mov		midat,>midat
		jmp 	bomb2,>midat
		 	
index 	for 12 ;maxins 1000
		dat		0, 0
rof

start   spl		bomb2,<-5001
bomb	mov		midat,>midat
		mov		midat,>midat
		add		#8, midat
		jmp 	bomb,>midat
        end
