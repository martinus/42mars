;redcode-88
;name Vamp
;author Samuel Owens
;strategy light blanket spl/jump to trap commands
;strategy trapped opponents do self-destructive core wipe
;assert CORESIZE == 8000
 
loc equ 93
dist equ 299
 
            DAT #0, #0     
splt        SPL 0, loc         ;keeps self safe from core wipe
start vamp    
            MOV ptr, @splt
            ADD #dist, splt    
            SUB #dist, ptr    
            JMZ start, splt -1 
            spl splt, <start -5    
ptr         spl @0, $-86    
trap        MOV bomb, <1      
            SPL -1, splt - 1     
            JMP trap, <start - 5
bomb        DAT #7, #7  
end vamp

