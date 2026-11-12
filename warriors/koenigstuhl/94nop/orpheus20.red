;redcode-94b
;assert 1
;name Orpheus2.0
;author David Castro
;strategy bombardero con cebos


ORG start

start   SPL Cebo1           
        SPL Cebo2             
        SPL Escuadron1        
        SPL Escuadron2      
        SPL Escuadron3  
        SPL Escuadron4
        JMP start

Cebo1:  
        MOV #0, @2            
        JMP -2                
        DAT #0, #0           

Cebo2:  
        MOV #0, @3            
        JMP -2               
        DAT #0, #0       


Escuadron1:
        ADD #13, 3            
        MOV 2, @2             
        JMP -2              
        DAT #42, #0         


Escuadron2:
        ADD #105, 3         
        MOV 2, @2            
        JMP -2               
        DAT #53, #0           


Escuadron3:
        ADD #512, 3         
        MOV 2, @2             
        JMP -2              
        DAT #87, #0         
Escuadron4:
        ADD #4, 3         
        MOV 2, @2           
        JMP -2               
        DAT #0, #0     

END start

