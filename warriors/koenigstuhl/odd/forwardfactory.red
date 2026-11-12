;redcode-94
;name FORWARD FACTORY
;author Ana
;assert 1

			org     start

myindex		dat		$0,		$0 			
start       add 	#1021, 	myindex		
			mov 	mydat, 	>myindex	
			mov 	bomb,  	>myindex	
			mov 	bomb+1, >myindex	
			mov 	bomb+2, @myindex	
			spl		<myindex, <1711
            jmp 	start, <1728

mydat   	dat		$0,		#5		
bomb		mov		mydat,	>mydat	
			mov		mydat,	>mydat	
			jmp 	bomb,	>mydat
