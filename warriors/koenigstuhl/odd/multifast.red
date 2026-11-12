;redcode
;name MultiFast
;author Zul Nadzri
;strategy Easter Tournament March 2016
;strategy Evolving warriors from scratch took longer than expected.
;strategy So, optimizing published warriors with uGP3, kind of overkill only to adjust those 2 constants.
;strategy Stay alive, and hope to damage opponent processes.
;assert 1

ptr1 equ 581 
ptr2 equ 2789

	  	spl 2
	  	spl 1
	  	spl 1

pNext  		spl	ptr1,	{pThis
        	mov  	}pThis,	}pNext
        	mov   	pDat,	>ptr2
pThis   	mov 	pNext+6, 	}pNext
        	jmz.f 	pNext, 	*pThis
pDat    	dat  		<2667,  	<2667*2

end
